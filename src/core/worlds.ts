// 兩個世界的語意狀態與規則。純資料、不碰畫面。
// Rust 這邊的 checkRust 就是這個專案對 borrow checker 的理解；
// 它與 rustc 不一致的地方，由 pages.test.ts 對照 verified.json 抓出來。

import type { ArmEvent, JsEvent, RustEvent } from './trace.ts';

// ---- 範圍（兩個世界共用） ----

export type ScopeKind = 'root' | 'fn' | 'block';

export interface ScopeRec {
  label: string;
  kind: ScopeKind;
  parent: string | null;
  /** 還沒離開；離開之後紀錄留著（排版要知道它曾經有哪些變數） */
  open: boolean;
  /** 在這個範圍宣告過的變數，依宣告順序；只增不減 */
  bindings: string[];
  /** bindings 裡哪些是 Rust 的參考變數（不握值、不佔夾具的位置，排在另一列）；JS 永遠是空的 */
  refs: string[];
}

/** 一排閘門：Rust 的 match、JS 的 switch。結束之後紀錄留著（排版要知道它有幾道）。 */
export interface MatchRec {
  /** 被比對的變數，以及它宣告在哪個範圍（閘門排在那個範圍的上方） */
  on: string;
  scope: string;
  /** 寫出來的分支，照程式碼的順序 */
  arms: string[];
  /** 已經試過的分支 */
  tried: string[];
  /** 符合、值走進去的那一道；還沒有就是 null */
  taken: string | null;
  /** 還在進行中（還沒 end-match） */
  open: boolean;
}

/** 最外層範圍（main 的本體）的 id。它沒有框，也不能 exit。 */
export const ROOT = '';

interface Scoped {
  scopes: Record<string, ScopeRec>;
  /** 目前開著的範圍，最內層在最後；stack[0] 永遠是 ROOT */
  stack: string[];
  /** 每個變數最近一次宣告在哪個範圍 */
  scopeOf: Record<string, string>;
  matches: Record<string, MatchRec>;
}

const emptyScoped = (): Scoped => ({
  scopes: { [ROOT]: { label: '', kind: 'root', parent: null, open: true, bindings: [], refs: [] } },
  stack: [ROOT],
  scopeOf: {},
  matches: {},
});

const innermost = (s: Scoped): string => s.stack[s.stack.length - 1]!;

/** 最內層函式範圍的外面一層（回傳值要去的地方）；不在函式裡就是 null */
function callerScope(s: Scoped): string | null {
  for (let i = s.stack.length - 1; i > 0; i--) {
    if (s.scopes[s.stack[i]!]!.kind === 'fn') return s.stack[i - 1]!;
  }
  return null;
}

function declare(s: Scoped, name: string, scope: string): void {
  const rec = s.scopes[scope]!;
  if (!rec.bindings.includes(name)) rec.bindings.push(name);
  s.scopeOf[name] = scope;
}

function openScope(s: Scoped, id: string, kind: 'fn' | 'block', label: string): void {
  s.scopes[id] = { label, kind, parent: innermost(s), open: true, bindings: [], refs: [] };
  s.stack.push(id);
}

function closeScope(s: Scoped, id: string): void {
  s.scopes[id]!.open = false;
  s.stack.pop();
}

const enterProblem = (s: Scoped, id: string): string | null =>
  s.scopes[id] ? `範圍 ${id} 重複進入（同一個函式呼叫兩次要給不同的 id）` : null;

const exitProblem = (s: Scoped, id: string): string | null =>
  id === ROOT || innermost(s) !== id ? `範圍 ${id} 不是目前最內層的範圍` : null;

function armProblem(s: Scoped, ev: ArmEvent): string | null {
  const m = s.matches[ev.match];
  if (!m || !m.open) return `${ev.match} 不是進行中的 match／switch`;
  if (!m.arms.includes(ev.arm)) return `${ev.match} 沒有 ${ev.arm} 這個分支`;
  if (m.tried.includes(ev.arm)) return `${ev.arm} 這個分支已經試過`;
  if (m.taken !== null) return `值已經走進 ${m.taken}，後面的分支不會再試`;
  return null;
}

/** 試一道閘門：current 是被比對的值目前的變體／標籤 */
function tryArm(m: MatchRec, arm: string, current: string | null): void {
  m.tried.push(arm);
  if (arm === current) m.taken = arm;
}

const hasDup = (list: string[]): boolean => new Set(list).size !== list.length;

// ---- Rust ----

/**
 * ref：參考變數，不握值；它借了什麼、還亮不亮記在 RustState.borrows。
 * shares：Rc 值的擁有者之一（value 是那顆值；有幾個擁有者記在值的 owners）。
 * pipe：握著一條管線（迭代器），不握值；管線記在 RustState.pipes。
 */
export type RustBindingState = 'owns' | 'moved' | 'gone' | 'ref' | 'shares' | 'pipe';

export interface Borrow {
  /** 被借的值 */
  value: string;
  /** `&mut` */
  mut: boolean;
  /** 光束還亮著（還沒過最後一次使用） */
  live: boolean;
  /** slice 照到的範圍 [起點, 終點]，0..1；整顆值是 [0, 1] */
  part: [number, number];
  /** 執行期借用（RefCell 的守衛）：到執行時才登記，要 drop 才歸還。編譯期的借用沒有這個欄位 */
  runtime?: true;
  /** 生命週期綁著的值（被照著的那顆以外也算）：這道參考不能活得比它們久。沒有標註就沒有這個欄位 */
  tied?: string[];
  /** 生命週期的名字（`'a`），畫在綁線上 */
  life?: string;
}

/** 一條管線（迭代器鏈）。結束之後紀錄留著（排版要知道它有幾段）。 */
export interface PipeRec {
  /** 源頭借著的值 */
  source: string;
  /** 第一個握著它的變數宣告在哪個範圍（管線畫在那個範圍的上方） */
  scope: string;
  /** 每一段的名字，照接上去的順序 */
  stages: string[];
  /** holders[i]：接上第 i 段之後握著管線的變數 */
  holders: string[];
  /** collect 產出的值；還沒有人要結果就是 null（惰性：這時值不會流） */
  sink: string | null;
  /** 還沒流完（還沒 end-pipe）；握著它的變數沒 collect 就離開 scope 也算結束 */
  open: boolean;
}

export interface RustState extends Scoped {
  /** 同一時間不能有兩個同名的變數（遮蔽要在軌跡裡換名字） */
  bindings: Record<string, { state: RustBindingState; value: string | null }>;
  values: Record<
    string,
    {
      label: string;
      alive: boolean;
      owner: string | null;
      lastOwner: string | null;
      /** lastOwner 宣告在哪個範圍（值碎掉之後畫面還要知道它原本在哪） */
      scope: string | null;
      /** 型別是 Copy：指定時複製，不搬走 */
      copy: boolean;
      /** 包在 RefCell 裡：借用在執行期登記。一般的值沒有這個欄位 */
      cell?: true;
      /** 包在 Rc 裡才有：目前的擁有者（引用計數就是它的長度）。Rc 的值 owner／lastOwner 永遠是 null */
      owners?: string[];
      /** 包在 Rc 裡才有：曾經擁有過它的變數，只增不減（排版用） */
      sharers?: string[];
    }
  >;
  /** 每個參考變數的借用；變數離開 scope 時移除 */
  borrows: Record<string, Borrow>;
  /**
   * 握著盒子的變數（wrap）。裡面的值記在 bindings[name].value（空盒是 null，state 仍是 owns：握著的是盒子）。
   * 值被 open 交出去之後紀錄留著（畫面上是打開的空盒），變數離開 scope 時移除。
   */
  boxes: Record<string, BoxRec>;
  /** 管線，key 是 pipe 事件給的 id */
  pipes: Record<string, PipeRec>;
  /** 先宣告、還沒指定的參考變數（declare-ref）；指定（borrow）之後移除 */
  unset: string[];
  /** 帶過生命週期綁定（tied）的參考變數，只增不減（排版要替綁線留位置） */
  tiedRefs: string[];
}

export interface BoxRec {
  /** 這次的變體：`Some`、`None`、`Ok`、`Err` */
  variant: string;
  /** `Result` 的雙色盒子這次亮哪一色；`Option` 的單色盒子是 null */
  side: 'ok' | 'err' | null;
  /** 已經打開（if let／match 看過裡面） */
  open: boolean;
}

/**
 * 借用的規則（括號內是 rustc 對應的錯誤碼）：
 *   mut-while-shared       有 `&` 亮著時借 `&mut`（E0502）
 *   borrow-while-mut       有 `&mut` 亮著時再借任何一種（E0499／E0502）
 *   use-while-mut          有 `&mut` 亮著時擁有者自己讀值（E0502／E0503）
 *   move-while-borrowed    有借用亮著時 move、return 或 drop 被借的值（E0505）
 *   mutate-while-borrowed  有借用亮著時擁有者改值（E0506）
 *   mutate-through-shared  透過 `&` 改值（E0596）
 *   dangling-ref           參考活得比值久：回傳指向區域值的參考、範圍結束時外面還有光束照著裡面的值（E0515／E0597）
 *
 * 型別與窮舉的規則（不是 borrow checker，但同樣在編譯期擋下）：
 *   unopened-box           盒子（Option／Result）還沒打開，就把它當成裡面的值來用（E0599／E0369）
 *   non-exhaustive-match   match 的分支沒有涵蓋所有可能（E0004）
 *
 * 生命週期（編譯期）：
 *   outlives-value         參考活得比生命週期綁著的值久：綁著的值碎了之後還用它、或它還亮著時那顆值就要碎（E0597）。
 *                          和 dangling-ref 的差別：這道參考實際照著的值可能還活著，被擋是因為簽名把它和另一顆值綁在一起
 *
 * 執行期（不是編譯錯誤，是 panic；規則內容和 borrow-while-mut／mut-while-shared 一樣，刻意分開命名）：
 *   refcell-already-borrowed  RefCell 已經登記了衝突的借用還沒歸還，又 borrow／borrow_mut 一次
 */
export type RustRule =
  | 'use-after-move' | 'undeclared' | 'out-of-scope' | 'invalid-trace'
  | 'mut-while-shared' | 'borrow-while-mut' | 'use-while-mut' | 'move-while-borrowed'
  | 'mutate-while-borrowed' | 'mutate-through-shared' | 'dangling-ref'
  | 'unopened-box' | 'non-exhaustive-match' | 'outlives-value' | 'refcell-already-borrowed';

export interface Violation {
  rule: RustRule;
  detail: string;
}

export const emptyRust = (): RustState => ({
  bindings: {}, values: {}, borrows: {}, boxes: {}, pipes: {}, unset: [], tiedRefs: [], ...emptyScoped(),
});

const invalid = (detail: string): Violation => ({ rule: 'invalid-trace', detail });

function readable(s: RustState, name: string): Violation | null {
  const b = s.bindings[name];
  if (!b) return { rule: 'undeclared', detail: `${name} 還沒宣告` };
  if (b.state === 'moved') return { rule: 'use-after-move', detail: `${name} 的值已經被搬走` };
  if (b.state === 'gone') return { rule: 'out-of-scope', detail: `${name} 已經離開 scope` };
  return null;
}

/** 還亮著、照著 value 的借用（參考變數的名字）；還沒流完的管線也借著它的源頭（握著管線的變數的名字） */
export function liveBorrows(s: RustState, value: string | null): string[] {
  if (!value) return [];
  const names = Object.keys(s.borrows).filter((name) => s.borrows[name]!.live && s.borrows[name]!.value === value);
  for (const p of Object.values(s.pipes)) {
    if (p.open && p.source === value) names.push(p.holders[p.holders.length - 1]!);
  }
  return names;
}

/** Rc 值的引用計數；不是 Rc 的值回傳 null */
export function rcCount(s: RustState, value: string): number | null {
  return s.values[value]?.owners?.length ?? null;
}

/** name 握著哪一條管線（現在握著、或曾經握著而成了空殼）；沒有就是 null */
export function pipeOf(s: RustState, name: string): string | null {
  for (const [id, p] of Object.entries(s.pipes)) if (p.holders.includes(name)) return id;
  return null;
}

/** name 離開的話，它的值會不會碎：唯一的擁有者，或 Rc 最後一個擁有者 */
function lastHold(s: RustState, name: string): boolean {
  const b = s.bindings[name];
  if (!b) return false;
  return b.state === 'owns' || (b.state === 'shares' && s.values[b.value!]!.owners!.length === 1);
}

/** name 是 Rc 的擁有者或握著管線：一般值的搬移、借用、改值都還沒有支援 */
function special(s: RustState, name: string): Violation | null {
  const st = s.bindings[name]?.state;
  if (st === 'shares') return invalid(`${name} 是 Rc 的擁有者之一，只支援 share、use、cell-borrow、cell-use、drop`);
  if (st === 'pipe') return invalid(`${name} 握著的是管線，不是值`);
  return null;
}

/** 還亮著、生命週期綁著 value、而且宣告在 scope 以外的參考（scope 是 null 就不限範圍） */
function tiedBy(s: RustState, value: string | null, scope: string | null): string[] {
  if (!value) return [];
  return Object.keys(s.borrows).filter((r) => {
    const bw = s.borrows[r]!;
    return bw.live && (bw.tied ?? []).includes(value) && (scope === null || s.scopeOf[r] !== scope);
  });
}

/** value 這個 RefCell 現在登記的借用，和新的一道（mut）衝不衝突；衝突就是執行時 panic */
function cellConflict(s: RustState, value: string, mut: boolean): Violation | null {
  const by = Object.keys(s.borrows).filter((r) => s.borrows[r]!.live && s.borrows[r]!.value === value);
  const hit = mut ? by : by.filter((r) => s.borrows[r]!.mut);
  return hit.length
    ? {
        rule: 'refcell-already-borrowed',
        detail: `這個 RefCell 已經被 ${hit.join('、')} 借走還沒歸還，執行到這裡會 panic（編譯擋不到）`,
      }
    : null;
}

/** via 握著（或共享著）的 RefCell 值；不是的話回傳違規 */
function cellOf(s: RustState, via: string): { value: string } | Violation {
  const bad = readable(s, via);
  if (bad) return bad;
  const value = isRef(s, via) ? null : s.bindings[via]!.value;
  if (!value || !s.values[value]!.cell) return invalid(`${via} 握的不是 RefCell`);
  return { value };
}

const isRef = (s: RustState, name: string): boolean => s.bindings[name]?.state === 'ref';

/** name 是握著值的擁有者（不是參考變數）；不是的話回傳違規 */
function owner(s: RustState, name: string): Violation | null {
  const bad = readable(s, name);
  if (bad) return bad;
  return isRef(s, name) ? invalid(`${name} 是參考變數，不握著值`) : null;
}

/** name 握著的值有沒有亮著的借用；有就回傳 rule 這條違規 */
function borrowed(s: RustState, name: string, rule: RustRule, what: string): Violation | null {
  const by = liveBorrows(s, s.bindings[name]?.value ?? null);
  return by.length ? { rule, detail: `${name} 的值還被 ${by.join('、')} 借著，不能${what}` } : null;
}

/** name 握著的值有沒有亮著的 `&mut` */
function mutBorrowed(s: RustState, name: string, rule: RustRule, what: string): Violation | null {
  const by = liveBorrows(s, s.bindings[name]?.value ?? null).filter((r) => s.borrows[r]?.mut);
  return by.length ? { rule, detail: `${name} 的值正被 ${by[0]} 以 &mut 借著，不能${what}` } : null;
}

/** 目前最內層函式範圍（含它裡面的 block）裡宣告的變數 */
function localToFn(s: RustState, name: string): boolean {
  for (let i = s.stack.length - 1; i > 0; i--) {
    if (s.scopeOf[name] === s.stack[i]) return true;
    if (s.scopes[s.stack[i]!]!.kind === 'fn') return false;
  }
  return false;
}

const holdsCopy = (s: RustState, name: string): boolean => {
  const v = s.bindings[name]?.value;
  return !!v && s.values[v]!.copy;
};

/** name 握著的是盒子（還在手上，不論開了沒）：盒子還不能搬、借、改 */
function boxed(s: RustState, name: string): Violation | null {
  return s.boxes[name] && s.bindings[name]?.state === 'owns'
    ? invalid(`${name} 握著的是盒子，盒子的搬移與借用還沒有支援`)
    : null;
}

/** match 看的東西：盒子看變體，一般的值看標籤 */
function variantOf(s: RustState, name: string): string | null {
  const box = s.boxes[name];
  if (box) return box.variant;
  const v = s.bindings[name]?.value;
  return v ? s.values[v]!.label : null;
}

/** 這個事件在目前狀態下合不合法；合法回傳 null */
export function checkRust(s: RustState, ev: RustEvent): Violation | null {
  const occupied = (name: string) => {
    const st = s.bindings[name]?.state;
    if (st === 'owns' || st === 'shares') return invalid(`${name} 已經握著別的值`);
    if (st === 'pipe') return invalid(`${name} 已經握著管線`);
    // 先宣告、還沒指定的參考變數（declare-ref）可以被指定一次
    return isRef(s, name) && !s.unset.includes(name) ? invalid(`${name} 已經是參考變數`) : null;
  };
  switch (ev.type) {
    case 'alloc':
      return s.values[ev.value] ? invalid(`值 ${ev.value} 重複配置`) : null;
    case 'bind': {
      const v = s.values[ev.value];
      if (!v || !v.alive) return invalid(`值 ${ev.value} 不存在`);
      if (v.owner) return invalid(`值 ${ev.value} 已經有擁有者 ${v.owner}`);
      if (v.owners?.length) return invalid(`值 ${ev.value} 是 Rc，多一個擁有者請用 share 事件`);
      return occupied(ev.binding);
    }
    case 'move': {
      const bad = owner(s, ev.from) ?? boxed(s, ev.from) ?? special(s, ev.from) ?? borrowed(s, ev.from, 'move-while-borrowed', '搬走');
      if (bad) return bad;
      if (holdsCopy(s, ev.from)) return invalid(`${ev.from} 的值是 Copy 型別，指定是複製，請用 copy 事件`);
      return occupied(ev.to);
    }
    case 'copy': {
      const bad =
        owner(s, ev.from) ?? boxed(s, ev.from) ?? special(s, ev.from) ?? mutBorrowed(s, ev.from, 'use-while-mut', '讀');
      if (bad) return bad;
      if (!holdsCopy(s, ev.from)) return invalid(`${ev.from} 的值不是 Copy 型別，指定是搬走，請用 move 事件`);
      if (s.values[ev.value]) return invalid(`值 ${ev.value} 重複配置`);
      return occupied(ev.to);
    }
    case 'use': {
      const bad = readable(s, ev.binding);
      if (bad) return bad;
      if (isRef(s, ev.binding)) {
        const bw = s.borrows[ev.binding]!;
        // 生命週期：它綁著的值已經碎了，這道參考就不能再用（即使它實際照著的值還活著）
        const dead = (bw.tied ?? []).find((v) => !s.values[v]!.alive);
        if (dead)
          return {
            rule: 'outlives-value',
            detail: `${ev.binding} 的生命週期綁著 ${s.values[dead]!.lastOwner ?? dead} 的值，那顆值已經碎了，不能再用它`,
          };
        return bw.live ? null : invalid(`${ev.binding} 的借用已經結束，不能再透過它使用值`);
      }
      if (s.bindings[ev.binding]!.state === 'pipe') return null;
      return mutBorrowed(s, ev.binding, 'use-while-mut', '讀');
    }
    case 'drop': {
      const b = s.bindings[ev.binding];
      if (!b || b.state === 'gone') return invalid(`${ev.binding} 不在 scope 內`);
      if (!lastHold(s, ev.binding)) return null;
      const tied = tiedBy(s, b.value, null);
      if (tied.length)
        return { rule: 'outlives-value', detail: `${ev.binding} 的值要碎了，${tied.join('、')} 的生命週期還綁著它` };
      return borrowed(s, ev.binding, 'move-while-borrowed', '丟掉');
    }
    case 'borrow': {
      const bad = owner(s, ev.of) ?? boxed(s, ev.of) ?? special(s, ev.of);
      if (bad) return bad;
      for (const t of ev.tied ?? []) {
        const no = owner(s, t) ?? special(s, t);
        if (no) return no;
        if (!s.bindings[t]!.value) return invalid(`${t} 沒有握著值，生命週期不能綁著它`);
      }
      const hit =
        mutBorrowed(s, ev.of, 'borrow-while-mut', '再借出去') ??
        (ev.mut ? borrowed(s, ev.of, 'mut-while-shared', '借出 &mut') : null);
      if (hit) return hit;
      if (ev.part && !(ev.part[0] >= 0 && ev.part[0] < ev.part[1] && ev.part[1] <= 1))
        return invalid(`${ev.binding} 的 part 要是 0..1 之間、由小到大的兩個比例`);
      return occupied(ev.binding);
    }
    case 'release':
      if (s.borrows[ev.binding]?.runtime) return invalid(`${ev.binding} 是 RefCell 的守衛，要 drop 才歸還（不適用 NLL）`);
      return isRef(s, ev.binding) && s.borrows[ev.binding]!.live
        ? null
        : invalid(`${ev.binding} 沒有亮著的借用可以結束`);
    case 'mutate': {
      const bad = readable(s, ev.binding) ?? boxed(s, ev.binding) ?? special(s, ev.binding);
      if (bad) return bad;
      if (isRef(s, ev.binding)) {
        const bw = s.borrows[ev.binding]!;
        if (!bw.live) return invalid(`${ev.binding} 的借用已經結束，不能再透過它改值`);
        return bw.mut ? null : { rule: 'mutate-through-shared', detail: `${ev.binding} 是 & 借用，只能讀` };
      }
      return borrowed(s, ev.binding, 'mutate-while-borrowed', '改');
    }
    case 'return-ref': {
      const bad = owner(s, ev.of) ?? boxed(s, ev.of) ?? special(s, ev.of);
      if (bad) return bad;
      if (callerScope(s) === null) return invalid('return-ref 只能出現在函式範圍裡');
      if (localToFn(s, ev.of))
        return { rule: 'dangling-ref', detail: `${ev.of} 是函式的區域變數，函式結束時值就碎了，參考不能回傳出去` };
      return mutBorrowed(s, ev.of, 'borrow-while-mut', '再借出去') ?? occupied(ev.to);
    }
    case 'enter': {
      const why = enterProblem(s, ev.scope);
      return why ? invalid(why) : null;
    }
    case 'exit': {
      const why = exitProblem(s, ev.scope);
      if (why) return invalid(why);
      // 裡面的值要碎了，外面卻還有光束照著它
      for (const name of s.scopes[ev.scope]!.bindings) {
        if (s.scopeOf[name] !== ev.scope || !lastHold(s, name)) continue;
        const out = liveBorrows(s, s.bindings[name]!.value).filter((r) => s.scopeOf[r] !== ev.scope);
        if (out.length)
          return { rule: 'dangling-ref', detail: `${name} 的值要碎了，${out.join('、')} 的光束還照著它` };
        // 生命週期：外面還亮著的參考沒有照著它，但簽名把那道參考和它綁在一起
        const tied = tiedBy(s, s.bindings[name]!.value, ev.scope);
        if (tied.length)
          return { rule: 'outlives-value', detail: `${name} 的值要碎了，${tied.join('、')} 的生命週期還綁著它` };
      }
      return null;
    }
    case 'return': {
      const bad =
        owner(s, ev.from) ?? boxed(s, ev.from) ?? special(s, ev.from) ?? borrowed(s, ev.from, 'move-while-borrowed', '回傳');
      if (bad) return bad;
      if (callerScope(s) === null) return invalid('return 只能出現在函式範圍裡');
      if (holdsCopy(s, ev.from)) return invalid('回傳 Copy 型別的值還沒有支援');
      return occupied(ev.to);
    }
    case 'wrap': {
      if (ev.value !== undefined) {
        const v = s.values[ev.value];
        if (!v || !v.alive) return invalid(`值 ${ev.value} 不存在`);
        if (v.owner) return invalid(`值 ${ev.value} 已經有擁有者 ${v.owner}`);
      }
      return occupied(ev.binding);
    }
    case 'open': {
      const bad = readable(s, ev.binding);
      if (bad) return bad;
      const box = s.boxes[ev.binding];
      if (!box) return invalid(`${ev.binding} 握的不是盒子`);
      if (s.bindings[ev.binding]!.value === null) {
        if (box.open) return invalid(`${ev.binding} 的盒子已經打開過了`);
        return ev.to ? invalid(`${ev.binding} 是空盒，沒有東西可以交給 ${ev.to}`) : null;
      }
      if (!ev.to) return invalid(`${ev.binding} 的盒子裡有值，打開時要交給一個變數（to）`);
      return borrowed(s, ev.binding, 'move-while-borrowed', '搬走') ?? occupied(ev.to);
    }
    case 'use-inner': {
      const bad = readable(s, ev.binding);
      if (bad) return bad;
      const box = s.boxes[ev.binding];
      if (!box) return checkRust(s, { type: 'use', binding: ev.binding });
      return box.open
        ? invalid(`${ev.binding} 的盒子已經打開，裡面的值要透過接手的變數用`)
        : { rule: 'unopened-box', detail: `${ev.binding} 握的是盒子（${box.variant}），還沒打開就不能當成裡面的值來用` };
    }
    case 'match': {
      if (s.matches[ev.id]) return invalid(`match ${ev.id} 重複（同一個 match 跑兩次要給不同的 id）`);
      const bad = owner(s, ev.on) ?? special(s, ev.on) ?? mutBorrowed(s, ev.on, 'use-while-mut', '讀');
      if (bad) return bad;
      if (hasDup(ev.arms) || hasDup(ev.of)) return invalid(`match ${ev.id} 的 arms／of 不能重複`);
      const stray = ev.arms.filter((arm) => !ev.of.includes(arm));
      if (stray.length) return invalid(`match ${ev.id} 的分支 ${stray.join('、')} 不在 of 裡`);
      const now = variantOf(s, ev.on);
      if (now === null || !ev.of.includes(now)) return invalid(`${ev.on} 目前是 ${now}，不在 of 裡`);
      const missing = ev.of.filter((v) => !ev.arms.includes(v));
      return missing.length
        ? { rule: 'non-exhaustive-match', detail: `match 少了 ${missing.join('、')} 這種情況` }
        : null;
    }
    case 'arm': {
      const why = armProblem(s, ev);
      return why ? invalid(why) : null;
    }
    case 'end-match': {
      const m = s.matches[ev.match];
      if (!m || !m.open) return invalid(`${ev.match} 不是進行中的 match`);
      if (m.taken === null) return invalid(`match ${ev.match} 還沒有任何分支符合，不能結束`);
      if (ev.yields !== undefined && !s.values[ev.yields]?.alive) return invalid(`值 ${ev.yields} 不存在`);
      return null;
    }
    case 'remove-arm': {
      const m = s.matches[ev.match];
      if (!m || !m.open) return invalid(`${ev.match} 不是進行中的 match`);
      if (!m.arms.includes(ev.arm)) return invalid(`${ev.match} 沒有 ${ev.arm} 這個分支`);
      return { rule: 'non-exhaustive-match', detail: `拔掉之後 match 少了 ${ev.arm} 這種情況` };
    }
    case 'declare-ref': {
      const b = s.bindings[ev.binding];
      return b && b.state !== 'gone' ? invalid(`${ev.binding} 已經宣告過了`) : null;
    }
    case 'share': {
      const bad = readable(s, ev.from);
      if (bad) return bad;
      if (s.bindings[ev.from]!.state !== 'shares') return invalid(`${ev.from} 握的不是 Rc，不能多一個擁有者`);
      return occupied(ev.to);
    }
    case 'cell-borrow': {
      const cell = cellOf(s, ev.of);
      if ('rule' in cell) return cell;
      // 先確認軌跡本身合法（變數沒被佔用），再看執行期的規則：這樣「弄壞它」只在真的會 panic 的時候成立
      return occupied(ev.binding) ?? cellConflict(s, cell.value, ev.mut === true);
    }
    case 'cell-use': {
      const cell = cellOf(s, ev.via);
      if ('rule' in cell) return cell;
      if (ev.label !== undefined && !ev.mut) return invalid('cell-use 要改值（label）必須是 mut');
      return cellConflict(s, cell.value, ev.mut === true);
    }
    case 'pipe': {
      if (s.pipes[ev.id]) return invalid(`管線 ${ev.id} 重複`);
      const bad =
        owner(s, ev.of) ?? boxed(s, ev.of) ?? special(s, ev.of) ?? mutBorrowed(s, ev.of, 'borrow-while-mut', '再借出去');
      if (bad) return bad;
      if (!s.bindings[ev.of]!.value) return invalid(`${ev.of} 沒有握著值`);
      return occupied(ev.binding);
    }
    case 'pipe-extend': {
      const p = s.pipes[ev.pipe];
      if (!p || !p.open || p.sink !== null) return invalid(`${ev.pipe} 不是還能再接的管線`);
      return readable(s, p.holders[p.holders.length - 1]!) ?? occupied(ev.to);
    }
    case 'collect': {
      const p = s.pipes[ev.pipe];
      if (!p || !p.open || p.sink !== null) return invalid(`${ev.pipe} 不是還沒 collect 的管線`);
      if (s.values[ev.value]) return invalid(`值 ${ev.value} 重複配置`);
      return readable(s, p.holders[p.holders.length - 1]!) ?? occupied(ev.to);
    }
    case 'pull': {
      const p = s.pipes[ev.pipe];
      if (!p || !p.open) return invalid(`${ev.pipe} 不是進行中的管線`);
      if (p.sink === null) return invalid(`管線 ${ev.pipe} 還沒有人要結果（collect），惰性的管線不會讓值流過`);
      if (ev.path.length < 1 || ev.path.length > p.stages.length + 1) return invalid('pull 的 path 長度要在 1 到段數加一之間');
      const through = ev.path.length === p.stages.length + 1;
      if (through !== (ev.label !== undefined)) return invalid('走完全程的值要給 label，被擋下的不能給');
      return null;
    }
    case 'end-pipe': {
      const p = s.pipes[ev.pipe];
      return p && p.open && p.sink !== null ? null : invalid(`${ev.pipe} 不是 collect 過、還沒結束的管線`);
    }
  }
}

/** 變數離開 scope：握著的值碎掉，變數本身消失；參考變數的光束跟著消失 */
function dropBinding(n: RustState, name: string): void {
  const b = n.bindings[name];
  if (!b || b.state === 'gone') return;
  delete n.borrows[name];
  delete n.boxes[name];
  n.unset = n.unset.filter((u) => u !== name);
  // 握著空盒（None）的變數 state 是 owns、value 是 null：沒有值可以碎
  if (b.state === 'owns' && b.value !== null) {
    const v = n.values[b.value!]!;
    v.alive = false;
    v.owner = null;
  }
  // Rc 的擁有者離開：計數減一，歸零才碎
  if (b.state === 'shares') {
    const v = n.values[b.value!]!;
    v.owners = v.owners!.filter((o) => o !== name);
    if (v.owners.length === 0) v.alive = false;
  }
  // 還握著管線就離開：管線跟著消失
  if (b.state === 'pipe') {
    const id = pipeOf(n, name);
    if (id) n.pipes[id]!.open = false;
  }
  b.state = 'gone';
  b.value = null;
}

/** to 接手 value；to 是新變數（或已經離開 scope 的同名變數）時宣告在 scope */
function give(n: RustState, to: string, value: string, scope: string): void {
  const old = n.bindings[to];
  if (!old || old.state === 'gone') declare(n, to, scope);
  n.bindings[to] = { state: 'owns', value };
  const v = n.values[value]!;
  v.owner = to;
  v.lastOwner = to;
  v.scope = n.scopeOf[to]!;
}

/** to 是不握值的變數（參考、握著管線的）：宣告在 scope，排在參考變數那一列 */
function declareRef(n: RustState, to: string, scope: string): void {
  declare(n, to, scope);
  const rec = n.scopes[scope]!;
  if (!rec.refs.includes(to)) rec.refs.push(to);
}

/** to 成為 value 的另一個擁有者（Rc）；to 是新變數時宣告在 scope */
function shareTo(n: RustState, to: string, value: string, scope: string): void {
  const old = n.bindings[to];
  if (!old || old.state === 'gone') declare(n, to, scope);
  n.bindings[to] = { state: 'shares', value };
  const v = n.values[value]!;
  v.owners!.push(to);
  if (!v.sharers!.includes(to)) v.sharers!.push(to);
}

/** to 成為參考變數，照著 value；宣告在 scope（先用 declare-ref 宣告過的留在原本的範圍） */
function lend(n: RustState, to: string, value: string, scope: string, mut: boolean, part: [number, number]): void {
  if (n.unset.includes(to)) n.unset = n.unset.filter((u) => u !== to);
  else declareRef(n, to, scope);
  n.bindings[to] = { state: 'ref', value: null };
  n.borrows[to] = { value, mut, live: true, part };
}

function take(n: RustState, from: string): string {
  const b = n.bindings[from]!;
  const value = b.value!;
  b.state = 'moved';
  b.value = null;
  return value;
}

export function applyRust(s: RustState, ev: RustEvent): RustState {
  const bad = checkRust(s, ev);
  if (bad) throw new Error(`Rust 軌跡不合法（${bad.rule}）：${bad.detail}`);
  const n = structuredClone(s);
  switch (ev.type) {
    case 'alloc':
      n.values[ev.value] = {
        label: ev.label, alive: true, owner: null, lastOwner: null, scope: null, copy: ev.copy === true,
      };
      if (ev.cell) n.values[ev.value]!.cell = true;
      if (ev.rc) Object.assign(n.values[ev.value]!, { owners: [], sharers: [] });
      break;
    case 'bind':
      if (n.values[ev.value]!.owners) shareTo(n, ev.binding, ev.value, innermost(n));
      else give(n, ev.binding, ev.value, innermost(n));
      break;
    case 'move':
      give(n, ev.to, take(n, ev.from), innermost(n));
      break;
    case 'copy': {
      const src = n.values[n.bindings[ev.from]!.value!]!;
      n.values[ev.value] = { label: src.label, alive: true, owner: null, lastOwner: null, scope: null, copy: true };
      give(n, ev.to, ev.value, innermost(n));
      break;
    }
    case 'use':
      break;
    case 'drop':
      dropBinding(n, ev.binding);
      break;
    case 'enter':
      openScope(n, ev.scope, ev.kind, ev.label);
      break;
    case 'exit':
      for (const name of [...n.scopes[ev.scope]!.bindings].reverse()) {
        if (n.scopeOf[name] === ev.scope) dropBinding(n, name);
      }
      closeScope(n, ev.scope);
      break;
    case 'return':
      give(n, ev.to, take(n, ev.from), callerScope(n)!);
      break;
    case 'borrow':
      lend(n, ev.binding, n.bindings[ev.of]!.value!, innermost(n), ev.mut === true, ev.part ? [...ev.part] : [0, 1]);
      if (ev.tied) {
        n.borrows[ev.binding]!.tied = ev.tied.map((t) => n.bindings[t]!.value!);
        n.borrows[ev.binding]!.life = ev.life ?? "'a";
        if (!n.tiedRefs.includes(ev.binding)) n.tiedRefs.push(ev.binding);
      }
      break;
    case 'release':
      n.borrows[ev.binding]!.live = false;
      break;
    case 'mutate': {
      const value = isRef(n, ev.binding) ? n.borrows[ev.binding]!.value : n.bindings[ev.binding]!.value!;
      n.values[value]!.label = ev.label;
      break;
    }
    case 'return-ref':
      lend(n, ev.to, n.bindings[ev.of]!.value!, callerScope(n)!, false, [0, 1]);
      break;
    case 'wrap':
      if (ev.value !== undefined) {
        give(n, ev.binding, ev.value, innermost(n));
      } else {
        const old = n.bindings[ev.binding];
        if (!old || old.state === 'gone') declare(n, ev.binding, innermost(n));
        n.bindings[ev.binding] = { state: 'owns', value: null };
      }
      n.boxes[ev.binding] = { variant: ev.variant, side: ev.side ?? null, open: false };
      break;
    case 'open':
      n.boxes[ev.binding]!.open = true;
      if (ev.to) give(n, ev.to, take(n, ev.binding), innermost(n));
      break;
    case 'use-inner':
      break;
    case 'match':
      n.matches[ev.id] = {
        on: ev.on, scope: n.scopeOf[ev.on] ?? ROOT, arms: [...ev.arms], tried: [], taken: null, open: true,
      };
      if (n.boxes[ev.on]) n.boxes[ev.on]!.open = true;
      break;
    case 'arm': {
      const m = n.matches[ev.match]!;
      tryArm(m, ev.arm, variantOf(n, m.on));
      break;
    }
    case 'end-match':
      n.matches[ev.match]!.open = false;
      break;
    case 'remove-arm':
      // checkRust 永遠擋下它，走不到這裡
      break;
    case 'declare-ref':
      declareRef(n, ev.binding, innermost(n));
      n.bindings[ev.binding] = { state: 'ref', value: null };
      n.borrows[ev.binding] = { value: '', mut: false, live: false, part: [0, 1] };
      n.unset.push(ev.binding);
      break;
    case 'share':
      shareTo(n, ev.to, n.bindings[ev.from]!.value!, innermost(n));
      break;
    case 'cell-borrow':
      lend(n, ev.binding, n.bindings[ev.of]!.value!, innermost(n), ev.mut === true, [0, 1]);
      n.borrows[ev.binding]!.runtime = true;
      break;
    case 'cell-use':
      if (ev.label !== undefined) n.values[n.bindings[ev.via]!.value!]!.label = ev.label;
      break;
    case 'pipe':
      declareRef(n, ev.binding, innermost(n));
      n.bindings[ev.binding] = { state: 'pipe', value: null };
      n.pipes[ev.id] = {
        source: n.bindings[ev.of]!.value!, scope: innermost(n), stages: [ev.stage], holders: [ev.binding],
        sink: null, open: true,
      };
      break;
    case 'pipe-extend': {
      const p = n.pipes[ev.pipe]!;
      n.bindings[p.holders[p.holders.length - 1]!]!.state = 'moved';
      declareRef(n, ev.to, innermost(n));
      n.bindings[ev.to] = { state: 'pipe', value: null };
      p.stages.push(ev.stage);
      p.holders.push(ev.to);
      break;
    }
    case 'collect': {
      const p = n.pipes[ev.pipe]!;
      n.bindings[p.holders[p.holders.length - 1]!]!.state = 'moved';
      n.values[ev.value] = { label: ev.label, alive: true, owner: null, lastOwner: null, scope: null, copy: false };
      give(n, ev.to, ev.value, innermost(n));
      p.sink = ev.value;
      break;
    }
    case 'pull':
      if (ev.label !== undefined) n.values[n.pipes[ev.pipe]!.sink!]!.label = ev.label;
      break;
    case 'end-pipe':
      n.pipes[ev.pipe]!.open = false;
      break;
  }
  return n;
}

// ---- JS ----

export interface JsState extends Scoped {
  bindings: Record<string, { live: boolean; value: string | null }>;
  /** 被 GC 收走的物件、跟著變數消失的 primitive 會從這裡移除 */
  values: Record<string, { label: string; prim: boolean }>;
  /** 連到空位（`undefined`）的變數；它們的 bindings[name].value 是 null */
  holes: string[];
  /** 飛行中的錯誤（throw 之後）；沒有就是 null */
  error: JsError | null;
}

export interface JsError {
  /** 錯誤的名字，例如 `TypeError` */
  label: string;
  /** 碰了哪個變數的空位才炸；範圍自己 throw 的是 null */
  binding: string | null;
  /** 閃電經過的範圍：trail[0] 是丟出錯誤的那一層，之後每 unwind 一次多一層 */
  trail: string[];
  /** 已經劈出最外層：沒有人接，程式中止 */
  out: boolean;
}

export const emptyJs = (): JsState => ({ bindings: {}, values: {}, holes: [], error: null, ...emptyScoped() });

/** 還有幾條線連著這顆值 */
export function jsRefCount(s: JsState, value: string): number {
  return Object.values(s.bindings).filter((b) => b.live && b.value === value).length;
}

function jsUnbind(n: JsState, name: string): void {
  const b = n.bindings[name];
  if (!b?.live) return;
  if (b.value && n.values[b.value]?.prim) delete n.values[b.value];
  n.holes = n.holes.filter((h) => h !== name);
  n.bindings[name] = { live: false, value: null };
}

export function applyJs(s: JsState, ev: JsEvent): JsState {
  const n = structuredClone(s);
  const fail = (why: string): never => {
    throw new Error(`JS 軌跡不合法：${why}`);
  };
  const live = (name: string) => {
    if (!n.bindings[name]?.live) fail(`${name} 不在 scope 內`);
  };
  const bindTo = (name: string, value: string) => {
    if (!n.bindings[name]?.live) declare(n, name, innermost(n));
    n.holes = n.holes.filter((h) => h !== name);
    n.bindings[name] = { live: true, value };
  };
  if (s.error?.out) fail('程式已經因為沒有人接的錯誤中止，之後不能再有事件');
  switch (ev.type) {
    case 'alloc':
      if (n.values[ev.value]) fail(`值 ${ev.value} 重複配置`);
      n.values[ev.value] = { label: ev.label, prim: ev.prim === true };
      break;
    case 'bind': {
      const v = n.values[ev.value];
      if (!v) fail(`值 ${ev.value} 不存在`);
      if (v!.prim && jsRefCount(n, ev.value) > 0) fail(`${ev.value} 是 primitive，指定是複製，請用 copy 事件`);
      bindTo(ev.binding, ev.value);
      break;
    }
    case 'copy': {
      live(ev.from);
      const src = n.bindings[ev.from]!.value;
      if (!src || !n.values[src]!.prim) fail(`${ev.from} 的值不是 primitive，指定是共享，請用 bind 事件`);
      if (n.values[ev.value]) fail(`值 ${ev.value} 重複配置`);
      n.values[ev.value] = { label: n.values[src!]!.label, prim: true };
      bindTo(ev.to, ev.value);
      break;
    }
    case 'use':
      live(ev.binding);
      break;
    case 'unbind':
      live(ev.binding);
      jsUnbind(n, ev.binding);
      break;
    case 'enter': {
      const why = enterProblem(n, ev.scope);
      if (why) fail(why);
      openScope(n, ev.scope, ev.kind, ev.label);
      break;
    }
    case 'exit': {
      const why = exitProblem(n, ev.scope);
      if (why) fail(why);
      for (const name of n.scopes[ev.scope]!.bindings) {
        if (n.scopeOf[name] === ev.scope) jsUnbind(n, name);
      }
      closeScope(n, ev.scope);
      break;
    }
    case 'gc':
      for (const id of Object.keys(n.values)) {
        if (jsRefCount(n, id) === 0) delete n.values[id];
      }
      break;
    case 'mutate': {
      live(ev.binding);
      const value = n.bindings[ev.binding]!.value;
      if (!value || !n.values[value]) fail(`${ev.binding} 沒有連著任何值`);
      if (n.values[value!]!.prim) fail(`${ev.binding} 的值是 primitive，不能就地修改`);
      n.values[value!]!.label = ev.label;
      break;
    }
    case 'return': {
      live(ev.from);
      const value = n.bindings[ev.from]!.value;
      const to = callerScope(n);
      if (to === null) fail('return 只能出現在函式範圍裡');
      if (!value || n.values[value]?.prim) fail('回傳 primitive 還沒有支援');
      if (!n.bindings[ev.to]?.live) declare(n, ev.to, to!);
      n.bindings[ev.to] = { live: true, value };
      break;
    }
    case 'bind-empty':
      if (n.bindings[ev.binding]?.live) fail(`${ev.binding} 已經宣告過了`);
      declare(n, ev.binding, innermost(n));
      n.bindings[ev.binding] = { live: true, value: null };
      n.holes.push(ev.binding);
      break;
    case 'match':
      if (n.matches[ev.id]) fail(`switch ${ev.id} 重複`);
      live(ev.on);
      if (hasDup(ev.arms)) fail(`switch ${ev.id} 的 case 不能重複`);
      n.matches[ev.id] = {
        on: ev.on, scope: n.scopeOf[ev.on] ?? ROOT, arms: [...ev.arms], tried: [], taken: null, open: true,
      };
      break;
    case 'arm': {
      const why = armProblem(n, ev);
      if (why) fail(why);
      const m = n.matches[ev.match]!;
      const value = n.bindings[m.on]?.value;
      tryArm(m, ev.arm, value ? n.values[value]!.label : 'undefined');
      break;
    }
    case 'end-match':
      if (!n.matches[ev.match]?.open) fail(`${ev.match} 不是進行中的 switch`);
      n.matches[ev.match]!.open = false;
      break;
    case 'throw':
      if (n.error) fail('已經有一個錯誤在飛');
      if (ev.binding !== undefined) {
        live(ev.binding);
        if (!n.holes.includes(ev.binding)) fail(`${ev.binding} 連著真的值，碰它不會炸`);
      }
      n.error = { label: ev.label, binding: ev.binding ?? null, trail: [innermost(n)], out: false };
      break;
    case 'unwind': {
      if (!n.error) fail('沒有錯誤在飛');
      const at = innermost(n);
      if (at === ROOT) {
        n.error!.out = true;
        break;
      }
      for (const name of n.scopes[at]!.bindings) {
        if (n.scopeOf[name] === at) jsUnbind(n, name);
      }
      closeScope(n, at);
      n.error!.trail.push(innermost(n));
      break;
    }
  }
  return n;
}
