// 音效：全部用 Web Audio 即時合成，沒有任何音檔。預設關閉。
//
// 分三塊：
//   1. 純函式（不碰 Web Audio、不碰 DOM，測試直接載入）：
//      crossedStep / createTrigger 決定「t 的變化 → 要不要播、播哪一步」，stepSound 決定「這一步播哪一種聲音」。
//   2. 合成：RECIPES 是每種聲音的配方（波形、頻率、包絡、增益），play 照配方排程。
//   3. 接線：attachSound 訂閱 t 的 store；開關狀態存在 localStorage。
//
// 沒有任何持續執行的 rAF 或 interval：只有「快速掃過之後等 t 靜下來」與「播完之後暫停 AudioContext」
// 兩個一次性的 setTimeout，沒有聲音要播時都不存在。

import type { Timeline } from '../core/timeline.ts';
import type { JsEvent, RustEvent, Step, Trace } from '../core/trace.ts';
import type { RustState } from '../core/worlds.ts';
import type { Store } from './store.ts';

// ── 1a. t 的變化 → 哪一步 ─────────────────────────────

/**
 * t 從 prev 走到 next 時，往前越過了哪一步的中點（k + 0.5）。
 * 越過很多個就只回傳最後一個；往回走、沒越過任何中點回傳 -1。剛好停在中點算越過（之後從中點出發不再算一次）。
 */
export function crossedStep(prev: number, next: number, steps: number): number {
  if (!(next > prev)) return -1;
  const k = Math.min(Math.floor(next - 0.5), steps - 1);
  return k >= 0 && prev < k + 0.5 ? k : -1;
}

/** t 走得比這個快（每秒幾步）就當成「掃過」：下一步按鈕是 1.54、播放是 1.11，一次跳兩步以上至少 3.08 */
export const FAST_STEPS_PER_SEC = 2.2;
/** 掃過之後 t 靜止這麼久，才播最後越過的那一步 */
export const SETTLE_MS = 140;
/** 兩次回呼隔超過這麼久，就不拿來算速度（那是一次新的動作的第一下） */
export const STALE_MS = 120;
/** 兩個聲音最少隔多久（滑桿在中點附近抖動時不連發） */
export const MIN_GAP_MS = 90;

export interface Trigger {
  /** t 變了（now 是毫秒）。回傳現在就該播的步驟索引；-1 是不播（沒越過中點、往回走，或掃得太快先保留） */
  move(t: number, now: number): number;
  /** 被保留的那一步可以播了就回傳它並清掉；還沒靜下來、或沒有保留，回傳 -1 */
  settle(now: number): number;
  /** 還要等多久才能 settle（毫秒）；沒有保留的步驟回傳 -1 */
  dueIn(now: number): number;
  /** 重新從 t 出發（音效剛打開時用）：不觸發任何聲音 */
  reset(t: number): void;
}

/**
 * 記住上一個 t，判斷每次變化要不要發聲。規則：
 *   - 只有往前越過中點才發聲；初始值不發聲；一次越過很多步只算最後一步。
 *   - 同一步要再響一次，得先往回拖過它的中點。
 *   - t 走得很快（快速拖曳、點程式碼行跳好幾步）時先不播，只記住最後越過的那一步，等 t 靜下來再播那一步；
 *     保留期間又往回拖過那一步的中點就取消。
 */
export function createTrigger(initial: number, steps: number): Trigger {
  let last = initial;
  let lastAt = -Infinity;
  let playedAt = -Infinity;
  let pending = -1;
  return {
    move(t, now) {
      const d = t - last;
      const dt = now - lastAt;
      const k = crossedStep(last, t, steps);
      last = t;
      lastAt = now;
      if (d < 0) {
        if (pending >= 0 && t < pending + 0.5) pending = -1;
        return -1;
      }
      if (k < 0) return -1;
      const fast = dt > 0 && dt < STALE_MS && (d / dt) * 1000 > FAST_STEPS_PER_SEC;
      if (fast || pending >= 0 || now - playedAt < MIN_GAP_MS) {
        pending = k;
        return -1;
      }
      playedAt = now;
      return k;
    },
    settle(now) {
      if (pending < 0 || now - lastAt < SETTLE_MS) return -1;
      const k = pending;
      pending = -1;
      playedAt = now;
      return k;
    },
    dueIn(now) {
      return pending < 0 ? -1 : Math.max(0, SETTLE_MS - (now - lastAt));
    },
    reset(t) {
      last = t;
      lastAt = -Infinity;
      pending = -1;
    },
  };
}

// ── 1b. 這一步 → 哪一種聲音 ───────────────────────────

export type SoundKind =
  | 'alloc' | 'bind' | 'move' | 'copy' | 'borrow' | 'borrowMut' | 'release' | 'releaseMut'
  | 'shatter' | 'tick' | 'soft' | 'zap' | 'sweep' | 'force';

/**
 * 同一步有很多事件時挑哪一個：排在前面的優先（越戲劇性、越是這一頁要講的事越前面）。
 *   shatter     值真的被釋放（drop／exit 之後值不再活著；Rc 要計數歸零才算）
 *   move        值換了主人：move、return、open 把值交出去、pipe-extend（管線搬給下一段）
 *   copy        多了一份／多了一個擁有者：copy、share
 *   borrowMut   `&mut` 亮起：borrow／cell-borrow／cell-use 帶 mut
 *   borrow      `&` 亮起：borrow、return-ref、cell-borrow、cell-use、pipe（源頭借著值）
 *   wrap        盒子扣上（聲音是 bind）。排在 alloc 前面：`Some(String::from(…))` 那一步的重點是盒子
 *   alloc       值出現：alloc、collect（接出一顆新值）
 *   releaseMut  `&mut` 熄滅
 *   release     `&` 熄滅：release、end-pipe、守衛被 drop、Rc 的擁有者離開但值還在（計數減一）
 *   bind        握住：bind（通常和 alloc 同一步，所以單獨聽到的機會不多）
 *   tick        用了一下：use、use-inner、mutate、arm、pull、open 只掀開蓋子
 *   soft        場面上的小事：enter、exit／drop 沒有東西碎掉、match、end-match、declare-ref、remove-arm
 */
const RANK = [
  'shatter', 'move', 'copy', 'borrowMut', 'borrow', 'wrap', 'alloc', 'releaseMut', 'release', 'bind', 'tick', 'soft',
] as const;
type Tag = (typeof RANK)[number];

function rustTag(ev: RustEvent): Tag {
  switch (ev.type) {
    case 'alloc':
    case 'collect':
      return 'alloc';
    case 'bind':
      return 'bind';
    case 'wrap':
      return 'wrap';
    case 'move':
    case 'return':
    case 'pipe-extend':
      return 'move';
    case 'open':
      return ev.to === undefined ? 'tick' : 'move';
    case 'copy':
    case 'share':
      return 'copy';
    case 'borrow':
    case 'cell-borrow':
    case 'cell-use':
      return ev.mut ? 'borrowMut' : 'borrow';
    case 'return-ref':
    case 'pipe':
      return 'borrow';
    case 'release':
    case 'end-pipe':
      return 'release';
    case 'use':
    case 'use-inner':
    case 'mutate':
    case 'arm':
    case 'pull':
      return 'tick';
    // drop 與 exit 本身只是「離開」；有沒有東西碎掉、有沒有借用熄滅，由前後兩個狀態判斷
    case 'drop':
    case 'exit':
    case 'enter':
    case 'match':
    case 'end-match':
    case 'remove-arm':
    case 'declare-ref':
      return 'soft';
  }
}

/** JS 世界的事件，只在這一步 Rust 世界沒有任何事件時才用得到 */
function jsSound(ev: JsEvent): SoundKind {
  switch (ev.type) {
    case 'throw':
    case 'unwind':
      return 'zap';
    case 'gc':
      return 'sweep';
    case 'alloc':
    case 'bind':
    case 'copy':
    case 'use':
    case 'unbind':
    case 'enter':
    case 'exit':
    case 'mutate':
    case 'return':
    case 'bind-empty':
    case 'match':
    case 'arm':
    case 'end-match':
      return 'soft';
  }
}

/**
 * 這一步要播的聲音。before／after 是這一步前後的 Rust 狀態（timeline.rustStates[k]、[k + 1]），
 * 用來看出事件本身看不出來的事：值有沒有真的碎掉、哪些借用跟著熄滅。
 * Rust 世界這一步沒有事件時，改看 JS 世界（GC 掃過、丟出錯誤）；兩邊都沒有就是 null。
 */
export function stepSound(step: Step, before: RustState, after: RustState): SoundKind | null {
  const tags = new Set<Tag>();
  let mutEnded = false;
  for (const ev of step.rust) {
    tags.add(rustTag(ev));
    if (ev.type === 'release' && before.borrows[ev.binding]?.mut) mutEnded = true;
  }
  if (tags.size > 0) {
    for (const [id, v] of Object.entries(before.values)) {
      if (v.alive && after.values[id]?.alive !== true) tags.add('shatter');
    }
    for (const [name, bw] of Object.entries(before.borrows)) {
      if (!bw.live || after.borrows[name]?.live === true) continue;
      tags.add('release');
      if (bw.mut) mutEnded = true;
    }
    for (const [name, b] of Object.entries(before.bindings)) {
      if (b.state === 'shares' && after.bindings[name]?.state !== 'shares') tags.add('release');
    }
    if (mutEnded && tags.delete('release')) tags.add('releaseMut');
    const top = RANK.find((tag) => tags.has(tag))!;
    return top === 'wrap' ? 'bind' : top;
  }
  let out: SoundKind | null = null;
  for (const ev of step.js) {
    const kind = jsSound(ev);
    if (out === null || kind !== 'soft') out = kind;
  }
  return out;
}

// ── 2. 合成 ──────────────────────────────────────────

/**
 * 一個發聲單位。時間的單位是秒、gain 是線性增益（1 = 0 dBFS）。
 * 包絡：at 起、a 秒線性升到 gain、停 hold 秒、指數衰減，到 at + len 時降到聽不見。
 * wave 是 'noise' 時 f 是濾波器的頻率（filter、q 必填）；有 to 就在整段 len 內由 f 滑到 to。
 */
interface Voice {
  wave: OscillatorType | 'noise';
  f: number;
  to?: number;
  at: number;
  a: number;
  hold?: number;
  len: number;
  gain: number;
  filter?: BiquadFilterType;
  q?: number;
}

/** 整體音量再乘上這個係數。每個配方各 voice 的 gain 加起來都不超過 0.125（約 -18 dBFS） */
const MASTER = 1;

export const RECIPES: Record<SoundKind, readonly Voice[]> = {
  // 值出現：清亮的一聲（E6 加高八度的泛音）
  alloc: [
    { wave: 'sine', f: 1318.5, at: 0, a: 0.004, len: 0.22, gain: 0.05 },
    { wave: 'sine', f: 2637, at: 0, a: 0.003, len: 0.11, gain: 0.016 },
  ],
  // 握住：「扣」。往下掉的三角波當本體，很短的高音當接觸的那一下
  bind: [
    { wave: 'triangle', f: 440, to: 250, at: 0, a: 0.002, len: 0.09, gain: 0.07 },
    { wave: 'sine', f: 1900, at: 0, a: 0.001, len: 0.03, gain: 0.02 },
  ],
  // 搬走：G4 滑到 D5
  move: [
    { wave: 'sine', f: 392, to: 587.3, at: 0, a: 0.02, len: 0.26, gain: 0.055 },
    { wave: 'sine', f: 784, to: 1174.7, at: 0, a: 0.02, len: 0.2, gain: 0.012 },
  ],
  // 複製：兩個一樣的短音（B5）
  copy: [
    { wave: 'sine', f: 987.8, at: 0, a: 0.003, len: 0.09, gain: 0.045 },
    { wave: 'sine', f: 987.8, at: 0.12, a: 0.003, len: 0.09, gain: 0.045 },
  ],
  // `&` 亮起：E5、B5、E6 依序疊上去
  borrow: [
    { wave: 'sine', f: 659.3, at: 0, a: 0.03, len: 0.3, gain: 0.032 },
    { wave: 'sine', f: 988.9, at: 0.06, a: 0.03, len: 0.27, gain: 0.022 },
    { wave: 'sine', f: 1318.5, at: 0.12, a: 0.03, len: 0.22, gain: 0.014 },
  ],
  // `&mut` 亮起：同樣的走法，低一個半八度（A3、E4、A4），底下那個音用三角波比較厚
  borrowMut: [
    { wave: 'triangle', f: 220, at: 0, a: 0.03, len: 0.36, gain: 0.045 },
    { wave: 'sine', f: 330, at: 0.06, a: 0.03, len: 0.3, gain: 0.03 },
    { wave: 'sine', f: 440, at: 0.12, a: 0.03, len: 0.24, gain: 0.02 },
  ],
  // 借用結束：同一組音倒著走，比較輕
  release: [
    { wave: 'sine', f: 1318.5, at: 0, a: 0.01, len: 0.16, gain: 0.016 },
    { wave: 'sine', f: 988.9, at: 0.05, a: 0.01, len: 0.17, gain: 0.018 },
    { wave: 'sine', f: 659.3, at: 0.1, a: 0.01, len: 0.18, gain: 0.02 },
  ],
  releaseMut: [
    { wave: 'sine', f: 440, at: 0, a: 0.01, len: 0.16, gain: 0.016 },
    { wave: 'sine', f: 330, at: 0.05, a: 0.01, len: 0.18, gain: 0.02 },
    { wave: 'triangle', f: 220, at: 0.1, a: 0.01, len: 0.2, gain: 0.028 },
  ],
  // 碎掉：高通的雜訊一下，加三個不成整數倍的高頻各自衰減（玻璃感）
  shatter: [
    { wave: 'noise', filter: 'highpass', f: 3000, q: 0.7, at: 0, a: 0.002, len: 0.1, gain: 0.06 },
    { wave: 'sine', f: 2793.8, at: 0, a: 0.002, len: 0.26, gain: 0.018 },
    { wave: 'sine', f: 3951, at: 0.015, a: 0.002, len: 0.2, gain: 0.013 },
    { wave: 'sine', f: 5274, at: 0.03, a: 0.002, len: 0.14, gain: 0.009 },
  ],
  // 用了一下
  tick: [{ wave: 'sine', f: 880, at: 0, a: 0.003, len: 0.09, gain: 0.028 }],
  // 場面上的小事
  soft: [{ wave: 'sine', f: 523.3, at: 0, a: 0.006, len: 0.1, gain: 0.016 }],
  // JS 丟出錯誤：鋸齒波急速往下掉，加一點很高的雜訊
  zap: [
    { wave: 'sawtooth', f: 1600, to: 180, at: 0, a: 0.002, len: 0.13, gain: 0.022 },
    { wave: 'noise', filter: 'highpass', f: 5000, q: 0.7, at: 0, a: 0.001, len: 0.06, gain: 0.03 },
  ],
  // JS 的 GC 掃過：帶通的雜訊由低掃到高
  sweep: [{ wave: 'noise', filter: 'bandpass', f: 500, to: 2600, q: 1.2, at: 0, a: 0.09, len: 0.4, gain: 0.04 }],
  // 力場彈開：往下掉的低頻一震，加兩個差 13 Hz 的三角波互相拍出來的嗡聲
  force: [
    { wave: 'sine', f: 110, to: 48, at: 0, a: 0.006, len: 0.3, gain: 0.085 },
    { wave: 'triangle', f: 147, at: 0.02, a: 0.03, hold: 0.12, len: 0.4, gain: 0.016 },
    { wave: 'triangle', f: 160, at: 0.02, a: 0.03, hold: 0.12, len: 0.4, gain: 0.016 },
  ],
};

/** 最後一個聲音結束後多久把 AudioContext 暫停（暫停之後音訊執行緒不再佔 CPU） */
const IDLE_MS = 1500;
const SILENT = 0.0001;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let idleTimer = 0;

function noiseBuffer(c: AudioContext): AudioBuffer {
  if (noiseBuf) return noiseBuf;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * 0.5), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noiseBuf = buf;
  return buf;
}

function schedule(c: AudioContext, out: AudioNode, kind: SoundKind): number {
  const t0 = c.currentTime + 0.015;
  let total = 0;
  for (const v of RECIPES[kind]) {
    const start = t0 + v.at;
    const end = start + v.len;
    const g = c.createGain();
    g.gain.setValueAtTime(SILENT, start);
    g.gain.linearRampToValueAtTime(v.gain, start + v.a);
    if (v.hold) g.gain.setValueAtTime(v.gain, start + v.a + v.hold);
    g.gain.exponentialRampToValueAtTime(SILENT, end);
    g.connect(out);
    let src: AudioScheduledSourceNode;
    let pitch: AudioParam;
    if (v.wave === 'noise') {
      const n = c.createBufferSource();
      n.buffer = noiseBuffer(c);
      const f = c.createBiquadFilter();
      f.type = v.filter ?? 'highpass';
      f.Q.value = v.q ?? 0.7;
      n.connect(f).connect(g);
      src = n;
      pitch = f.frequency;
    } else {
      const o = c.createOscillator();
      o.type = v.wave;
      o.connect(g);
      src = o;
      pitch = o.frequency;
    }
    pitch.setValueAtTime(v.f, start);
    if (v.to !== undefined) pitch.exponentialRampToValueAtTime(v.to, end);
    src.start(start);
    src.stop(end + 0.02);
    total = Math.max(total, v.at + v.len);
  }
  return total;
}

function play(kind: SoundKind): void {
  if (!on || typeof document === 'undefined' || document.hidden) return;
  try {
    // 第一次要發聲時才建立。會走到這裡一定是使用者動過手（按了開關、拖了滑桿、按了按鈕或鍵盤）
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = MASTER;
      master.connect(ctx.destination);
    }
    const c = ctx;
    const out = master!;
    const go = () => {
      const len = schedule(c, out, kind);
      clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => void c.suspend().catch(() => {}), len * 1000 + IDLE_MS);
    };
    if (c.state === 'running') {
      go();
      return;
    }
    // 暫停中：叫醒之後再排程。醒得太慢就放棄，免得好幾個聲音擠在醒來的那一刻一起響
    const asked = performance.now();
    void c.resume().then(
      () => {
        if (on && !document.hidden && performance.now() - asked < 250) go();
      },
      () => {},
    );
  } catch {
    // 這個瀏覽器不能出聲：安靜地放棄
  }
}

// ── 3. 開關與接線 ────────────────────────────────────

const KEY = 'ownership-theater:sound';

function readOn(): boolean {
  // 測試在 node 裡載入這個檔：沒有頁面就不去碰 localStorage
  if (typeof document === 'undefined') return false;
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

let on = readOn();
const watchers = new Set<() => void>();

export const isSoundOn = (): boolean => on;

/** 切換音效。打開的那一下播一聲「值出現」的音當作確認（AudioContext 也在這次點擊裡建立） */
export function setSoundOn(next: boolean): void {
  if (next === on) return;
  on = next;
  try {
    localStorage.setItem(KEY, next ? '1' : '0');
  } catch {
    // 存不了就只在這次瀏覽有效
  }
  for (const fn of watchers) fn();
  if (next) {
    play('alloc');
  } else {
    clearTimeout(idleTimer);
    void ctx?.suspend().catch(() => {});
  }
}

/** 「弄壞它」被力場彈開。不看 t 往哪個方向走 */
export function playBreak(): void {
  play('force');
}

/**
 * 訂閱一頁的時間 t：往前越過某一步的中點時，播那一步的聲音。回傳取消訂閱的函式。
 * 音效關著的時候回呼第一行就返回；打開的那一刻從目前的 t 重新出發。
 */
export function attachSound(store: Store<number>, trace: Trace, tl: Timeline): () => void {
  const trigger = createTrigger(store.get(), tl.steps);
  let timer = 0;

  const fire = (k: number) => {
    const step = trace.steps[k];
    const before = tl.rustStates[k];
    const after = tl.rustStates[k + 1];
    if (!step || !before || !after) return;
    const kind = stepSound(step, before, after);
    if (kind) play(kind);
  };
  const onTimer = () => {
    timer = 0;
    const now = performance.now();
    const k = trigger.settle(now);
    if (k >= 0) {
      fire(k);
      return;
    }
    const wait = trigger.dueIn(now);
    if (wait >= 0) timer = window.setTimeout(onTimer, Math.max(wait, 16));
  };
  const off = store.subscribe((t) => {
    if (!on) return;
    const now = performance.now();
    const k = trigger.move(t, now);
    if (k >= 0) fire(k);
    else if (!timer && trigger.dueIn(now) >= 0) timer = window.setTimeout(onTimer, SETTLE_MS);
  });
  const onToggle = () => {
    clearTimeout(timer);
    timer = 0;
    trigger.reset(store.get());
  };
  watchers.add(onToggle);
  return () => {
    off();
    watchers.delete(onToggle);
    clearTimeout(timer);
  };
}
