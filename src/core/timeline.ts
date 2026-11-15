// 軌跡 → 畫面狀態。整個場景是時間 t 的純函式：
//   buildTimeline(trace) 先算出每一步結束時的畫面快照，
//   stateAt(timeline, t) 在相鄰兩張快照之間內插。
// 沒有累積狀態，所以滑桿往回拖就是倒著演。

import type { BreakIt, Trace } from './trace.ts';
import {
  applyJs,
  applyRust,
  checkRust,
  emptyJs,
  emptyRust,
  jsRefCount,
  pipeOf,
  ROOT,
  type JsError,
  type JsState,
  type MatchRec,
  type RustState,
  type ScopeRec,
} from './worlds.ts';

/** 每個畫面物件的數值屬性；用不到的保持 0 */
export interface Num {
  x: number;
  y: number;
  alpha: number;
  /** link 的終點；sweeper 的出發點（拖在後面的軌跡從這裡畫起） */
  x2: number;
  y2: number;
  /** link 長出來的比例 0..1 */
  grow: number;
  /** 夾具夾緊的程度 0..1 */
  grip: number;
  /** 夾具是不是被搬空的空殼 0..1 */
  ghost: number;
  /** 值碎掉的進度 0..1 */
  shatter: number;
  /** JS 的值沒有任何線連著 0..1 */
  loose: number;
  /** 這一步被使用時的脈動 0..1..0（只在步驟中途不為 0） */
  pulse: number;
  /** 值在飛行途中 0..1..0（只在步驟中途不為 0） */
  flight: number;
  /** frame 的寬與高（x、y 是框的中心） */
  w: number;
  h: number;
  /** frame 的線型：0 實線（函式）、1 虛線（內層的 `{ }`） */
  dash: number;
  /** orb 被 GC 收走的進度 0..1（只在 GC 那一步的中途不為 0；掃地機掃到它才開始） */
  swept: number;
  /**
   * 借用亮不亮 0..1：beam 的亮度、lens 有沒有點亮。借用結束（release）那一步從 1 內插到 0，
   * 所以熄滅可以倒著拖。場景畫光束時用 alpha × lit。
   */
  lit: number;
  /** beam／lens 是不是 `&mut`：0 是 `&`（半透明），1 是 `&mut`（實心、較亮） */
  solid: number;
  /** beam 照到值的哪一段：起點與終點，0..1（值的左緣到右緣）。整顆值是 0 與 1；slice 是其中一段 */
  r0: number;
  r1: number;
  /** box 的蓋子掀開的程度 0..1（if let／match 打開盒子那一步從 0 內插到 1，可以倒著拖） */
  open: number;
  /** box 是不是 `Result` 的雙色盒子：0 是 `Option` 的單色盒，1 是左半 `Ok`、右半 `Err` 兩色 */
  duo: number;
  /** 雙色盒子這次亮哪一色：0 是 `Ok`，1 是 `Err`（duo 是 0 時沒有意義） */
  err: number;
  /** crystal 外面有沒有一層 RefCell 的殼：0 沒有、1 有 */
  cell: number;
  /**
   * RefCell 的殼上登記著借用 0..1：有守衛（cell-borrow）亮著時是 1；一行之內借了就還的（cell-use）
   * 只在那一步的中途 0..1..0。殼登記的是不是 `borrow_mut` 看 solid
   */
  lent: number;
}

const NUM_KEYS = [
  'x', 'y', 'alpha', 'x2', 'y2', 'grow', 'grip', 'ghost', 'shatter', 'loose', 'pulse', 'flight',
  'w', 'h', 'dash', 'swept', 'lit', 'solid', 'r0', 'r1', 'open', 'duo', 'err', 'cell', 'lent',
] as const satisfies readonly (keyof Num)[];

const zero = (): Num => ({
  x: 0, y: 0, alpha: 0, x2: 0, y2: 0, grow: 0, grip: 0, ghost: 0, shatter: 0, loose: 0, pulse: 0, flight: 0,
  w: 0, h: 0, dash: 0, swept: 0, lit: 0, solid: 0, r0: 0, r1: 0, open: 0, duo: 0, err: 0, cell: 0, lent: 0,
});

export type World = 'js' | 'rust';

/**
 * 畫面物件的種類。
 *   claw     Rust 的變數：夾具（grip、ghost）
 *   crystal  Rust 的 Move 型別的值：晶體（shatter、flight）
 *   chip     Rust 的 Copy 型別的值：小菱形；指定時是複製出一顆新的，原值留在原地（shatter、flight）
 *   tag      JS 的變數：小圓點
 *   orb      JS 的物件：漂在空中的光球，可以被很多條線連著（loose、swept）
 *   bead     JS 的 primitive：貼在變數上方的小珠子，指定時複製、跟著變數消失，不歸 GC 管（flight）
 *   link     JS 的變數連到值的線（x2、y2、grow；ref 是連到的 orb／bead）
 *   frame    範圍的框：函式呼叫或內層的 `{ }`（w、h、dash）；label 是框的名字
 *   sweeper  JS 的 GC 掃地機。不在任何快照裡，只在有 gc 事件的那一步中途由 stateAt 產生
 *   lens     Rust 的參考變數：一盞小燈，不握值、只發出光束（lit、solid）。排在所屬範圍的夾具上方另一列
 *   beam     借用的光束：從 lens（x、y）照到被借的值（x2、y2；ref 是那顆值）。
 *            lit 是亮度、solid 分 `&`／`&mut`、r0..r1 是照到值的哪一段（slice）。
 *            參考變數還在 scope 裡就一直在快照裡，借用結束後 lit 是 0（畫面上看不到）
 *   box      Rust 的盒子（Option／Result）：包住值的外框，畫在握著它的夾具裡，值（有的話）在盒子裡。
 *            open 是蓋子掀開的程度、duo／err 是雙色盒子與這次亮的那一色、
 *            ghost 是裡面的值已經被交出去（握著它的變數成了空殼）；label 是變體（Some／None／Ok／Err）
 *   gate     match／switch 的一道閘門，兩個世界共用；label 是分支。lit 是值走進這一道（0..1），
 *            ghost 是試過但不符合（0..1）；x2、y2 是被比對的值的位置（亮起時從那裡拉一條線進閘門）
 *   hole     JS 的空位（`undefined`）：變數的線連到的空虛線圈，位置和 bead 一樣貼在變數上方
 *   bolt     JS 的閃電的一段：從（x、y）劈到（x2、y2），grow 是劈出去的比例 0..1。
 *            throw 之後每往上飛一層多一段，劈過的留在畫面上
 *   spark    閃電的頭：錯誤目前飛到哪裡；label 是錯誤的名字
 *
 * 收尾區（第 13–17 頁）重用與新增的：
 *   link     也用在 Rust 世界：Rc 的每個擁有者（一隻沒夾東西的夾具）連一條線到共享的值（`rust:share:<變數>`）。
 *            畫法與顏色和 JS 的線完全一樣，是刻意的：Rust 世界裡出現了 JS 的東西
 *   lens     也用來畫握著管線的變數（不握值）：lit 是 1 表示管線現在在它手上，搬給下一段之後是 0
 *   beam     RefCell 的執行期借用也是光束（守衛變數的那一道在快照裡；cell-use 的只在那一步中途由 stateAt 產生，
 *            從擁有者的夾具照到值，id 是 `rust:flash:<i>`）
 *   crystal  cell 是 1 時外面多一層 RefCell 的殼，lent／solid 是殼上登記的借用
 *   note     只有文字的標示：Rc 值下方的引用計數（`計數 2`）。值碎掉之後留著 `計數 0`（alpha 較低）。
 *            數字另外放在 count：顯示端依介面語言組出文字（`count 2`），label 是中文的預設寫法
 *   pipe     管線的一段：從（x2、y2）接到這一段的節點（x、y），grow 是接上去的比例 0..1；label 是這一段的名字。
 *            label 是空字串的是 collect 接上的出口（沒有節點，終點在產出的值上方）
 *   item     流過管線的一個值（小菱形，標籤在下方）。不在任何快照裡，只在 pull 那一步的中途由 stateAt 產生
 *   tether   生命週期的綁線：從參考變數的燈（x、y）拉到它綁著的值（x2、y2；ref 是那顆值）的虛線，
 *            lit 跟著那道借用走；label 是生命週期的名字（`'a`）。意思是「這道光束最多活到這顆值碎掉」
 */
export type VisualKind =
  | 'claw' | 'crystal' | 'chip' | 'tag' | 'orb' | 'bead' | 'link' | 'frame' | 'sweeper' | 'lens' | 'beam'
  | 'box' | 'gate' | 'hole' | 'bolt' | 'spark' | 'note' | 'pipe' | 'item' | 'tether';

export interface Visual {
  /** `rust:lens:r`、`rust:beam:r`、`rust:claw:a`、`rust:val:v1`、`rust:frame:pass`、`js:tag:a`、`js:orb:o1`、`js:link:a`、`js:frame:pass`、`js:gc` */
  id: string;
  world: World;
  kind: VisualKind;
  label: string;
  /** 只有引用計數的 note 有：計數的數字，與語言無關 */
  count?: number;
  /** link 連到哪一顆 orb／bead */
  ref: string | null;
  /** 各世界自己的區域座標，原點在世界中心；場景負責把兩個世界擺開 */
  n: Num;
}

interface Pt {
  x: number;
  y: number;
}

/** 某一步的 GC：掃地機沿 y 從 x0 掃到 x1，收走 ids 這幾顆 orb */
export interface Sweep {
  y: number;
  x0: number;
  x1: number;
  ids: string[];
}

/** 某一步的 switch 沒有任何 case 接住：值的影子從閘門旁邊溜過去（只在那一步中途看得到） */
export interface Slip {
  from: Pt;
  to: Pt;
}

/** 某一步的 cell-use：一道只在這一步中途亮起的光束，從 from 照到 to（值的畫面 id） */
export interface Flash {
  from: Pt;
  to: string;
  mut: boolean;
}

/** 某一步的 pull：一個值沿著 points 流過管線，走在第 j 段路上時的樣子是 labels[j] */
export interface Flow {
  points: Pt[];
  labels: string[];
}

export interface Timeline {
  /** 步數 N；t 的範圍是 0..N */
  steps: number;
  /** N+1 張快照，frames[k] 是做完前 k 步的畫面 */
  frames: Map<string, Visual>[];
  /** 每一步碰到的物件 id */
  touched: { js: string[]; rust: string[] }[];
  /** 每一步被「使用」而要脈動的物件 id */
  pulses: string[][];
  /** 每一步新出現、而且要從別的位置冒出來的物件（複製出來的值從原值的位置分出來） */
  origins: Record<string, Pt>[];
  /** 每一步的 GC；那一步沒有 gc 事件就是 null */
  sweeps: (Sweep | null)[];
  /** 每一步溜過閘門的值；那一步沒有落空的 switch 就是 null */
  slips: (Slip | null)[];
  /** 每一步一行之內借了就還的執行期借用（cell-use） */
  flashes: Flash[][];
  /** 每一步流過管線的值；那一步沒有 pull 就是 null */
  flows: (Flow | null)[];
  /**
   * 每個世界的內容範圍（區域座標，已含標籤與世界標題的餘裕），場景照這個取景。
   * 只有一列變數時是 x ±2.6、y -2.0..2.7；Rust 每多一列（函式框、內層 scope、變數超過兩個）y1 加 RUST_PITCH，
   * 有 match 的閘門再加 GATE_ROOM。
   */
  bounds: { halfX: number; y0: number; y1: number };
  /**
   * 置中的標籤往世界外側（JS 的左邊、Rust 的右邊）最遠伸到離世界中心多遠，用字數估的。
   * 場景取景時把它算進去，最外側那一欄的長標籤才不會貼到畫面邊緣；比內容範圍短的時候沒有作用。
   */
  reachX: number;
  rustStates: RustState[];
  jsStates: JsState[];
}

/** 相鄰兩個變數欄位的間距（一列最多兩個夾具） */
export const SLOT = 2.6;
/** 值在飛行途中抬高多少 */
export const LIFT = 0.9;
/** Rust 相鄰兩列的距離：外層範圍在下，內層（函式、`{ }`）往上疊 */
export const RUST_PITCH = 2.35;
const RUST_COLS = 2;
/** 一列放得下的寬度；JS 的變數與 orb 超過兩個就在這個寬度內平均分 */
const ROW_SPAN = 5.2;
const TAG_Y = -1.3;
const ORB_Y = 1.0;
/** bead 在它的變數上方多高 */
const BEAD_DY = 0.6;
/** 參考變數那一列在所屬範圍最上面一列夾具的上方多高 */
const LENS_DY = 1.85;
/** 有參考變數的範圍要多留的高度：最外層（沒有框）與有框的範圍 */
const LENS_ROOM = 0.9;
const LENS_ROOM_FRAMED = 1.4;
/** 閘門那一排在所屬範圍最上面一列變數的上方多高（Rust 從夾具算、JS 從變數的小圓點算） */
const GATE_DY = 1.95;
/** 有閘門的範圍要多留的高度 */
const GATE_ROOM = 0.7;
/** 握著盒子的夾具張得比較開（盒子比晶體大） */
const BOX_GRIP = 0.45;
/** 閃電每往上一層抬高多少；起點在框的上緣上方 BOLT_BASE */
const BOLT_RISE = 0.75;
const BOLT_BASE = 0.55;
/** 閃電劈出頂端的位置：離內容上緣多遠（要留位置給錯誤的名字與世界標題） */
const BOLT_TOP = 0.95;
/** Rc 的值放哪：擁有者都在同一個範圍時在它們上方正中（和 JS 的光球一樣），否則放在右側、高度取擁有者的平均 */
const SHARED_DY = 1.6;
const SHARED_X = 1.8;
/** 有生命週期綁線的參考變數：所屬範圍多留的高度（綁線要穿到上面的內層範圍，燈不能壓在內層的框上） */
const TETHER_ROOM = 0.7;
/** 有 Rc 的值浮在上方的範圍要多留的高度 */
const RC_ROOM = 0.9;
/** 引用計數標在值的下方多遠 */
const COUNT_DY = -0.78;
/** 握著 RefCell 的夾具張得比較開（外面多一層殼） */
const CELL_GRIP = 0.55;
/** 管線的節點那一排在所屬範圍最上面一列夾具的上方多高；兩段時節點的間距；握著管線的變數在節點上方多高 */
const PIPE_DY = 1.9;
const PIPE_GAP = 1.5;
const PIPE_LENS_DY = 0.95;
/** 管線的入口與出口在值的上方多高（讓出值的標籤） */
const PIPE_PORT = 1.1;
/** 有管線的範圍要多留的高度（加在參考變數那一列的 LENS_ROOM 之上） */
const PIPE_ROOM = 0.5;
const BASE_BOTTOM = -2.0;
const BASE_TOP = 2.7;
const HALF_X = 2.6;

export const rustClawId = (b: string) => `rust:claw:${b}`;
export const rustValId = (v: string) => `rust:val:${v}`;
export const rustFrameId = (scope: string) => `rust:frame:${scope}`;
export const rustLensId = (b: string) => `rust:lens:${b}`;
export const rustBeamId = (b: string) => `rust:beam:${b}`;
export const jsTagId = (b: string) => `js:tag:${b}`;
export const jsOrbId = (v: string) => `js:orb:${v}`;
export const jsLinkId = (b: string) => `js:link:${b}`;
export const jsFrameId = (scope: string) => `js:frame:${scope}`;
export const rustBoxId = (b: string) => `rust:box:${b}`;
export const gateId = (world: World, match: string, arm: string) => `${world}:gate:${match}:${arm}`;
export const jsHoleId = (b: string) => `js:hole:${b}`;
/** 閃電的第 i 段（1 起算：第 i 次到達的地方） */
export const jsBoltId = (i: number) => `js:bolt:${i}`;
export const rustShareId = (b: string) => `rust:share:${b}`;
export const rustCountId = (v: string) => `rust:count:${v}`;
/** 管線的第 i 段；出口那一段的 i 是 'out' */
export const rustPipeId = (pipe: string, i: number | 'out') => `rust:pipe:${pipe}:${i}`;
export const rustTetherId = (b: string, v: string) => `rust:tether:${b}:${v}`;
export const RUST_FLOW_ID = 'rust:flow';
export const JS_SPARK_ID = 'js:spark';
export const JS_SLIP_ID = 'js:slip';
export const JS_GC_ID = 'js:gc';

/** 置中在物件上的標籤（frame 靠左、tether 與 hole 在旁邊，不算） */
const CENTERED: ReadonlySet<VisualKind> = new Set([
  'claw', 'crystal', 'chip', 'tag', 'orb', 'bead', 'lens', 'box', 'gate', 'spark', 'note', 'pipe',
]);
/** 標籤一個字多寬（區域座標，以桌面常見的取景估）：變數名的字比較大；全形字算兩個字 */
const LABEL_CH = 0.085;
const LABEL_CH_NAME = 0.105;
const LABEL_PAD = 0.06;

/** 這個物件的標籤往世界外側伸到多遠 */
function labelReach(v: Visual): number {
  if (!v.label || !CENTERED.has(v.kind)) return 0;
  let chars = 0;
  for (const c of v.label) chars += c.charCodeAt(0) > 0x2e7f ? 2 : 1;
  const ch = v.kind === 'claw' || v.kind === 'tag' ? LABEL_CH_NAME : LABEL_CH;
  return (v.world === 'js' ? -v.n.x : v.n.x) + (chars * ch) / 2 + LABEL_PAD;
}

const rowX = (i: number, count: number, spacing = SLOT) => (i - (count - 1) / 2) * spacing;
const spread = (count: number) => (count <= 2 ? SLOT : ROW_SPAN / count);

interface Box extends Pt {
  w: number;
  h: number;
}

/** 整條軌跡固定的排版：每個範圍、每個變數、每顆 orb 的位置不隨時間變動 */
interface Plan {
  rustSlot(scope: string, name: string): Pt;
  /** 參考變數（lens）的位置 */
  rustLens(scope: string, name: string): Pt;
  rustFrame(scope: string): Box;
  jsSlot(scope: string, name: string): Pt;
  jsFrame(scope: string): Box;
  orb(id: string): Pt;
  /** 閘門的位置：第 i 道（共 count 道），排在 scope 最上面一列變數的上方 */
  rustGate(scope: string, i: number, count: number): Pt;
  jsGate(i: number, count: number): Pt;
  /** Rc 的值（很多個擁有者共享）放哪 */
  rustShared(value: string): Pt;
  /** 管線的形狀：入口（源頭的值上方）、每一段的節點、出口（產出的值上方；整條軌跡都沒 collect 就是 null） */
  rustPipe(id: string): { inlet: Pt; nodes: Pt[]; outlet: Pt | null };
  /** 沒有變數握著的 Rust 值、沒有變數的 bead 放哪 */
  rustFree: Pt;
  jsFree: Pt;
  bounds: Timeline['bounds'];
}

function depthOf(scopes: Record<string, ScopeRec>, id: string): number {
  let d = 0;
  for (let p = scopes[id]?.parent ?? null; p !== null; p = scopes[p]?.parent ?? null) d++;
  return d;
}

const sumBefore = (list: number[], d: number) => {
  let total = 0;
  for (let i = 0; i < d; i++) total += list[i] ?? 0;
  return total;
};

/**
 * Rust：一列最多兩個夾具，超過就往上多排一列；內層範圍整個疊在外層上面，外面畫框。
 * 參考變數不佔夾具的位置：排在所屬範圍夾具的上方另一列，光束往下照到值。
 * 同一層的範圍不會同時開著（呼叫堆疊），所以共用同一塊位置。
 * JS：所有變數排成一列，外層在左、內層在右，內層的變數外面畫框；orb 在上方另一列。
 */
function makePlan(last: RustState, js: Record<string, ScopeRec>, orbs: string[]): Plan {
  const rust = last.scopes;
  const rustMatches = last.matches;
  const names = (scopes: Record<string, ScopeRec>, id: string) => scopes[id]?.bindings ?? [];

  const refs = (id: string) => rust[id]?.refs ?? [];
  const claws = (id: string) => names(rust, id).filter((name) => !refs(id).includes(name));
  const lensRoom = (id: string) => (refs(id).length === 0 ? 0 : id === ROOT ? LENS_ROOM : LENS_ROOM_FRAMED);
  /** 閘門排在範圍的上方（和參考變數那一列同一個位置；同一個範圍兩種都有的情況還沒有處理） */
  const gateRoom = (id: string) => (Object.values(rustMatches).some((m) => m.scope === id) ? GATE_ROOM : 0);
  const rustRowsOf = (id: string) => Math.max(1, Math.ceil(claws(id).length / RUST_COLS));
  const scopeOfVar = (name: string) => last.scopeOf[name] ?? ROOT;
  /** Rc 的值浮在這個範圍的上方（擁有者全都宣告在這裡）；和參考變數那一列、閘門同一個位置，同時有的情況還沒有處理 */
  const rcRoom = (id: string) =>
    Object.values(last.values).some((v) => v.sharers?.length && v.sharers.every((nm) => scopeOfVar(nm) === id))
      ? RC_ROOM
      : 0;
  const tethered = (name: string) => last.tiedRefs.includes(name);
  const tetherRoom = (id: string) => (refs(id).some(tethered) ? TETHER_ROOM : 0);
  const pipeRoom = (id: string) => (Object.values(last.pipes).some((p) => p.scope === id) ? PIPE_ROOM : 0);
  const depthRows: number[] = [];
  /** 每一層為參考變數那一列多留的高度 */
  const depthLens: number[] = [];
  for (const id of Object.keys(rust)) {
    const d = depthOf(rust, id);
    depthRows[d] = Math.max(depthRows[d] ?? 0, rustRowsOf(id));
    depthLens[d] = Math.max(depthLens[d] ?? 0, lensRoom(id) + gateRoom(id) + rcRoom(id) + pipeRoom(id) + tetherRoom(id));
  }
  const rustRows = Math.max(1, sumBefore(depthRows, depthRows.length));
  const top = BASE_TOP + (rustRows - 1) * RUST_PITCH + sumBefore(depthLens, depthLens.length);
  /** scope 的第 r 列夾具的 y */
  const rowY = (scope: string, r: number) => {
    const d = depthOf(rust, scope);
    return (sumBefore(depthRows, d) + r) * RUST_PITCH + sumBefore(depthLens, d);
  };
  // JS 永遠只有一列變數，Rust 變高時把 JS 的內容移到垂直中央
  const jsShift = (top - BASE_TOP) / 2;

  const depthCols: number[] = [];
  for (const id of Object.keys(js)) {
    const d = depthOf(js, id);
    depthCols[d] = Math.max(depthCols[d] ?? 0, names(js, id).length, id === ROOT ? 0 : 1);
  }
  const jsCols = Math.max(1, sumBefore(depthCols, depthCols.length));
  const jsSpacing = spread(jsCols);
  const jsCol = (scope: string, i: number) => sumBefore(depthCols, depthOf(js, scope)) + i;

  const rustFree: Pt = { x: 0, y: 1.6 };
  const rustSlot = (scope: string, name: string): Pt => {
    const list = claws(scope);
    const i = Math.max(0, list.indexOf(name));
    const r = Math.floor(i / RUST_COLS);
    const inRow = Math.max(1, Math.min(RUST_COLS, list.length - r * RUST_COLS));
    return { x: rowX(i % RUST_COLS, inRow), y: rowY(scope, r) };
  };
  const rustShared = (value: string): Pt => {
    const at = (last.values[value]?.sharers ?? []).map((nm) => ({ scope: scopeOfVar(nm), p: rustSlot(scopeOfVar(nm), nm) }));
    const first = at[0];
    if (!first) return rustFree;
    const avg = (pick: (p: Pt) => number) => at.reduce((total, a) => total + pick(a.p), 0) / at.length;
    return at.every((a) => a.scope === first.scope)
      ? { x: avg((p) => p.x), y: rowY(first.scope, rustRowsOf(first.scope) - 1) + SHARED_DY }
      : { x: SHARED_X, y: avg((p) => p.y) };
  };
  /** 值最後待的位置（管線的入口、出口用；值中途被搬走的情況還沒有處理） */
  const lastValueAt = (id: string): Pt => {
    const v = last.values[id];
    if (v?.sharers) return rustShared(id);
    const at = v ? (v.owner ?? v.lastOwner) : null;
    return v && at ? rustSlot(v.scope ?? ROOT, at) : rustFree;
  };

  return {
    rustSlot,
    rustShared,
    rustPipe(id) {
      const p = last.pipes[id]!;
      const count = p.stages.length;
      const y = rowY(p.scope, rustRowsOf(p.scope) - 1) + PIPE_DY;
      const port = (value: string | null): Pt | null => {
        if (value === null) return null;
        const at = lastValueAt(value);
        return { x: at.x, y: at.y + PIPE_PORT };
      };
      return {
        inlet: port(p.source)!,
        nodes: p.stages.map((_, i) => ({ x: rowX(i, count, count <= 2 ? PIPE_GAP : ROW_SPAN / count), y })),
        outlet: port(p.sink),
      };
    },
    rustLens(scope, name) {
      const list = refs(scope);
      const i = Math.max(0, list.indexOf(name));
      const y = rowY(scope, rustRowsOf(scope) - 1) + LENS_DY;
      // 只有一盞、又帶著生命週期綁線的燈往左偏：光束往下、綁線往上，正中間留給兩邊的變數名
      if (list.length === 1 && tethered(name)) return { x: -SLOT / 2, y };
      return { x: rowX(i, Math.max(1, list.length), spread(list.length)), y };
    },
    rustFrame(scope) {
      const rows = rustRowsOf(scope);
      const cols = Math.max(1, Math.min(RUST_COLS, claws(scope).length));
      const n = refs(scope).length;
      const room = lensRoom(scope);
      // 下緣要包住變數名（夾具下方 1.2），上緣要包住值的標籤（上方 0.85）；有參考變數時上緣再往上包住那一列
      return {
        x: 0,
        y: rowY(scope, (rows - 1) / 2) - 0.15 + room / 2,
        w: Math.max((cols - 1) * SLOT + 2.3, n > 0 ? (n - 1) * spread(n) + 1.6 : 0),
        h: (rows - 1) * RUST_PITCH + 2.4 + room,
      };
    },
    jsSlot(scope, name) {
      const i = Math.max(0, names(js, scope).indexOf(name));
      return { x: rowX(jsCol(scope, i), jsCols, jsSpacing), y: TAG_Y + jsShift };
    },
    jsFrame(scope) {
      const cols = Math.max(1, names(js, scope).length);
      const x = rowX(jsCol(scope, 0) + (cols - 1) / 2, jsCols, jsSpacing);
      // 下緣包住變數名，上緣包住 bead
      return { x, y: TAG_Y + jsShift + 0.1, w: (cols - 1) * jsSpacing + Math.min(1.5, jsSpacing - 0.2), h: 1.8 };
    },
    orb(id) {
      return { x: rowX(Math.max(0, orbs.indexOf(id)), Math.max(1, orbs.length), spread(orbs.length)), y: ORB_Y + jsShift };
    },
    rustGate(scope, i, count) {
      return { x: rowX(i, count, spread(count)), y: rowY(scope, rustRowsOf(scope) - 1) + GATE_DY };
    },
    jsGate(i, count) {
      return { x: rowX(i, count, spread(count)), y: TAG_Y + jsShift + GATE_DY };
    },
    rustFree,
    jsFree: { x: 0, y: ORB_Y + jsShift },
    bounds: { halfX: HALF_X, y0: BASE_BOTTOM, y1: top },
  };
}

function frameVisual(world: World, id: string, rec: ScopeRec, box: Box): Visual {
  const n = zero();
  n.x = box.x;
  n.y = box.y;
  n.w = box.w;
  n.h = box.h;
  n.alpha = 1;
  n.dash = rec.kind === 'block' ? 1 : 0;
  return { id, world, kind: 'frame', label: rec.label, ref: null, n };
}

/** 一排閘門的畫面物件；at 是被比對的值的位置 */
function gateVisuals(world: World, id: string, m: MatchRec, at: Pt, pos: (i: number, count: number) => Pt): Visual[] {
  return m.arms.map((arm, i) => {
    const n = zero();
    const p = pos(i, m.arms.length);
    n.x = p.x;
    n.y = p.y;
    n.x2 = at.x;
    n.y2 = at.y;
    n.alpha = 1;
    n.lit = m.taken === arm ? 1 : 0;
    n.ghost = m.tried.includes(arm) && m.taken !== arm ? 1 : 0;
    return { id: gateId(world, id, arm), world, kind: 'gate', label: arm, ref: null, n };
  });
}

function layoutRust(s: RustState, plan: Plan): Map<string, Visual> {
  const out = new Map<string, Visual>();
  for (const [id, rec] of Object.entries(s.scopes)) {
    if (!rec.open || rec.kind === 'root') continue;
    out.set(rustFrameId(id), frameVisual('rust', rustFrameId(id), rec, plan.rustFrame(id)));
  }
  const valueAt = (id: string): Pt => {
    const v = s.values[id];
    if (v?.sharers) return plan.rustShared(id);
    const at = v ? (v.owner ?? v.lastOwner) : null;
    return v && at ? plan.rustSlot(v.scope ?? ROOT, at) : plan.rustFree;
  };
  for (const [name, b] of Object.entries(s.bindings)) {
    if (b.state === 'gone') continue;
    const n = zero();
    const held = pipeOf(s, name);
    if (held !== null) {
      // 握著管線的變數：一盞燈，排在它接上的那一段節點的上方；管線搬給下一段（或被 collect 消耗）之後熄掉
      const node = plan.rustPipe(held).nodes[s.pipes[held]!.holders.indexOf(name)]!;
      n.x = node.x;
      n.y = node.y + PIPE_LENS_DY;
      n.alpha = 1;
      n.lit = b.state === 'pipe' ? 1 : 0;
      out.set(rustLensId(name), { id: rustLensId(name), world: 'rust', kind: 'lens', label: name, ref: null, n });
      continue;
    }
    if (b.state === 'ref') {
      // 參考變數：一盞燈加一道光束。借用結束後燈還在（變數還在 scope），光束的 lit 是 0
      const bw = s.borrows[name]!;
      const p = plan.rustLens(s.scopeOf[name] ?? ROOT, name);
      const end = valueAt(bw.value);
      n.x = p.x;
      n.y = p.y;
      n.alpha = 1;
      n.lit = bw.live ? 1 : 0;
      n.solid = bw.mut ? 1 : 0;
      out.set(rustLensId(name), { id: rustLensId(name), world: 'rust', kind: 'lens', label: name, ref: null, n });
      const beam: Num = { ...n, x2: end.x, y2: end.y, r0: bw.part[0], r1: bw.part[1] };
      out.set(rustBeamId(name), {
        id: rustBeamId(name), world: 'rust', kind: 'beam', label: '', ref: rustValId(bw.value), n: beam,
      });
      // 生命週期綁著、但沒有被照著的值：各拉一條綁線
      for (const t of bw.tied ?? []) {
        if (t === bw.value) continue;
        const to = valueAt(t);
        out.set(rustTetherId(name, t), {
          id: rustTetherId(name, t), world: 'rust', kind: 'tether', label: bw.life ?? "'a", ref: rustValId(t),
          n: { ...n, x2: to.x, y2: to.y },
        });
      }
      continue;
    }
    const p = plan.rustSlot(s.scopeOf[name] ?? ROOT, name);
    n.x = p.x;
    n.y = p.y;
    n.alpha = 1;
    const box = s.boxes[name];
    const cell = b.state === 'owns' && b.value !== null && s.values[b.value]?.cell === true;
    n.grip = b.state === 'owns' ? (box ? BOX_GRIP : cell ? CELL_GRIP : 1) : 0;
    n.ghost = b.state === 'moved' ? 1 : 0;
    out.set(rustClawId(name), { id: rustClawId(name), world: 'rust', kind: 'claw', label: name, ref: null, n });
    if (b.state === 'shares') {
      // Rc 的擁有者：夾具沒有夾東西，連一條線到共享的值（和 JS 的線同一種畫法）
      const end = valueAt(b.value!);
      const l = zero();
      l.x = p.x;
      l.y = p.y;
      l.x2 = end.x;
      l.y2 = end.y;
      l.alpha = 1;
      l.grow = 1;
      out.set(rustShareId(name), {
        id: rustShareId(name), world: 'rust', kind: 'link', label: '', ref: rustValId(b.value!), n: l,
      });
    }
    if (box) {
      const bn = zero();
      bn.x = p.x;
      bn.y = p.y;
      bn.alpha = 1;
      bn.open = box.open ? 1 : 0;
      bn.duo = box.side ? 1 : 0;
      bn.err = box.side === 'err' ? 1 : 0;
      bn.ghost = b.state === 'moved' ? 1 : 0;
      out.set(rustBoxId(name), { id: rustBoxId(name), world: 'rust', kind: 'box', label: box.variant, ref: null, n: bn });
    }
  }
  for (const [id, m] of Object.entries(s.matches)) {
    if (!m.open) continue;
    const at = plan.rustSlot(m.scope, m.on);
    for (const g of gateVisuals('rust', id, m, at, (i, count) => plan.rustGate(m.scope, i, count))) out.set(g.id, g);
  }
  for (const [id, p] of Object.entries(s.pipes)) {
    if (!p.open) continue;
    const geo = plan.rustPipe(id);
    const seg = (key: number | 'out', label: string, from: Pt, to: Pt) => {
      const n = zero();
      n.x = to.x;
      n.y = to.y;
      n.x2 = from.x;
      n.y2 = from.y;
      n.alpha = 1;
      n.grow = 1;
      out.set(rustPipeId(id, key), { id: rustPipeId(id, key), world: 'rust', kind: 'pipe', label, ref: null, n });
    };
    p.stages.forEach((stage, i) => seg(i, stage, i === 0 ? geo.inlet : geo.nodes[i - 1]!, geo.nodes[i]!));
    if (p.sink !== null && geo.outlet) seg('out', '', geo.nodes[geo.nodes.length - 1]!, geo.outlet);
  }
  for (const [id, v] of Object.entries(s.values)) {
    const n = zero();
    const p = valueAt(id);
    n.x = p.x;
    n.y = p.y;
    n.alpha = 1;
    n.shatter = v.alive ? 0 : 1;
    if (v.cell) {
      const guards = Object.values(s.borrows).filter((bw) => bw.runtime && bw.live && bw.value === id);
      n.cell = 1;
      n.lent = guards.length ? 1 : 0;
      n.solid = guards.some((bw) => bw.mut) ? 1 : 0;
    }
    out.set(rustValId(id), {
      id: rustValId(id), world: 'rust', kind: v.copy ? 'chip' : 'crystal', label: v.label, ref: null, n,
    });
    if (v.owners) {
      const c = zero();
      c.x = p.x;
      c.y = p.y + COUNT_DY;
      c.alpha = v.alive ? 1 : 0.6;
      out.set(rustCountId(id), {
        id: rustCountId(id), world: 'rust', kind: 'note', label: `計數 ${v.owners.length}`, count: v.owners.length, ref: null, n: c,
      });
    }
  }
  return out;
}

function layoutJs(s: JsState, plan: Plan): Map<string, Visual> {
  const out = new Map<string, Visual>();
  for (const [id, rec] of Object.entries(s.scopes)) {
    if (!rec.open || rec.kind === 'root') continue;
    out.set(jsFrameId(id), frameVisual('js', jsFrameId(id), rec, plan.jsFrame(id)));
  }
  const slot = (name: string) => plan.jsSlot(s.scopeOf[name] ?? ROOT, name);
  const valuePos = new Map<string, Pt>();
  for (const [id, v] of Object.entries(s.values)) {
    const n = zero();
    let p: Pt;
    if (v.prim) {
      const owner = Object.keys(s.bindings).find((name) => s.bindings[name]!.live && s.bindings[name]!.value === id);
      const at = owner ? slot(owner) : null;
      p = at ? { x: at.x, y: at.y + BEAD_DY } : plan.jsFree;
    } else {
      p = plan.orb(id);
      n.loose = jsRefCount(s, id) === 0 ? 1 : 0;
    }
    n.x = p.x;
    n.y = p.y;
    n.alpha = 1;
    valuePos.set(id, p);
    out.set(jsOrbId(id), { id: jsOrbId(id), world: 'js', kind: v.prim ? 'bead' : 'orb', label: v.label, ref: null, n });
  }
  for (const [name, b] of Object.entries(s.bindings)) {
    if (!b.live) continue;
    const p = slot(name);
    const t = zero();
    t.x = p.x;
    t.y = p.y;
    t.alpha = 1;
    out.set(jsTagId(name), { id: jsTagId(name), world: 'js', kind: 'tag', label: name, ref: null, n: t });
    const hole = s.holes.includes(name);
    if (hole) {
      const h = zero();
      h.x = p.x;
      h.y = p.y + BEAD_DY;
      h.alpha = 1;
      out.set(jsHoleId(name), { id: jsHoleId(name), world: 'js', kind: 'hole', label: 'undefined', ref: null, n: h });
    }
    const end = hole ? { x: p.x, y: p.y + BEAD_DY } : b.value ? valuePos.get(b.value) : undefined;
    if (end) {
      const l = zero();
      l.x = p.x;
      l.y = p.y;
      l.x2 = end.x;
      l.y2 = end.y;
      l.alpha = 1;
      l.grow = 1;
      out.set(jsLinkId(name), {
        id: jsLinkId(name), world: 'js', kind: 'link', label: '', ref: hole ? jsHoleId(name) : jsOrbId(b.value!), n: l,
      });
    }
  }
  for (const [id, m] of Object.entries(s.matches)) {
    if (!m.open) continue;
    const v = s.bindings[m.on]?.value;
    const base = slot(m.on);
    const at = (v ? valuePos.get(v) : undefined) ?? { x: base.x, y: base.y + BEAD_DY };
    for (const g of gateVisuals('js', id, m, at, (i, count) => plan.jsGate(i, count))) out.set(g.id, g);
  }
  if (s.error) {
    const pts = boltPoints(s, s.error, plan);
    for (let i = 1; i < pts.length; i++) {
      const n = zero();
      n.x = pts[i - 1]!.x;
      n.y = pts[i - 1]!.y;
      n.x2 = pts[i]!.x;
      n.y2 = pts[i]!.y;
      n.alpha = 1;
      n.grow = 1;
      out.set(jsBoltId(i), { id: jsBoltId(i), world: 'js', kind: 'bolt', label: '', ref: null, n });
    }
    const tip = pts[pts.length - 1]!;
    const n = zero();
    n.x = tip.x;
    n.y = tip.y;
    n.alpha = 1;
    out.set(JS_SPARK_ID, { id: JS_SPARK_ID, world: 'js', kind: 'spark', label: s.error.label, ref: null, n });
  }
  return out;
}

/**
 * 閃電的轉折點：丟出錯誤的地方（空位，或那一層的框上方），之後每到一層往上抬一點；
 * 劈出最外層之後多一個頂端的點。位置只看 error 與固定的排版，所以範圍被劈穿、關掉之後也不會動。
 */
function boltPoints(s: JsState, e: JsError, plan: Plan): Pt[] {
  const pts: Pt[] = [];
  e.trail.forEach((scope, i) => {
    const prev = pts[i - 1];
    if (i === 0 && e.binding !== null) {
      const p = plan.jsSlot(s.scopeOf[e.binding] ?? ROOT, e.binding);
      pts.push({ x: p.x, y: p.y + BEAD_DY });
    } else if (scope === ROOT) {
      // 最外層沒有框：第一個點放在空中，之後的從上一層的正上方稍微偏一點繼續往上
      pts.push(prev ? { x: prev.x + 0.45, y: prev.y + BOLT_RISE } : plan.jsFree);
    } else {
      const box = plan.jsFrame(scope);
      pts.push({ x: box.x, y: box.y + box.h / 2 + BOLT_BASE + BOLT_RISE * i });
    }
  });
  if (e.out) {
    const last = pts[pts.length - 1]!;
    pts.push({ x: last.x, y: Math.max(last.y + 0.3, plan.bounds.y1 - BOLT_TOP) });
  }
  return pts;
}

export function buildTimeline(trace: Trace): Timeline {
  const orbs: string[] = [];
  for (const step of trace.steps) {
    for (const ev of step.js) {
      if (ev.type === 'alloc' && !ev.prim && !orbs.includes(ev.value)) orbs.push(ev.value);
    }
  }

  let rust = emptyRust();
  let js = emptyJs();
  const rustStates = [rust];
  const jsStates = [js];
  const touched: Timeline['touched'] = [];
  const pulses: string[][] = [];
  /** 複製出來的值：第幾步、新值的畫面 id、原值的畫面 id */
  const splits: { step: number; id: string; from: string }[] = [];
  /** 每一步被 GC 收走的 orb */
  const collected: string[][] = [];
  /** 落空的 switch：第幾步、哪一個 switch */
  const missed: { step: number; id: string }[] = [];
  /** cell-use：第幾步、從哪個夾具照到哪顆值 */
  const flashed: { step: number; from: string; to: string; mut: boolean }[] = [];
  /** pull：第幾步、哪條管線、值一路上的樣子 */
  const pulled: { step: number; pipe: string; path: string[] }[] = [];

  trace.steps.forEach((step, i) => {
    const tr = new Set<string>();
    const tj = new Set<string>();
    const pulse = new Set<string>();
    const swept: string[] = [];
    for (const ev of step.rust) {
      const before = rust;
      rust = applyRust(rust, ev);
      const held = (b: string) => before.bindings[b]?.value ?? null;
      /** 變數在這個事件之前的畫面物件：參考變數是燈加光束，其餘是夾具 */
      const varIds = (b: string) =>
        pipeOf(before, b) !== null
          ? [rustLensId(b)]
          : before.bindings[b]?.state === 'ref'
            ? [rustLensId(b), rustBeamId(b)]
            : before.bindings[b]?.state === 'shares'
              ? [rustClawId(b), rustShareId(b), rustCountId(held(b)!)]
              : [rustClawId(b)];
      const pipeIds = (id: string) => [
        ...rust.pipes[id]!.stages.map((_, j) => rustPipeId(id, j)),
        ...(rust.pipes[id]!.sink !== null ? [rustPipeId(id, 'out')] : []),
      ];
      /** 透過變數碰到的值：參考變數是它借的那顆 */
      const reach = (b: string) => (before.bindings[b]?.state === 'ref' ? before.borrows[b]!.value : held(b));
      switch (ev.type) {
        case 'alloc':
          tr.add(rustValId(ev.value));
          break;
        case 'borrow':
          tr.add(rustLensId(ev.binding)).add(rustBeamId(ev.binding)).add(rustValId(held(ev.of)!));
          break;
        case 'return-ref':
          tr.add(rustLensId(ev.to)).add(rustBeamId(ev.to)).add(rustValId(held(ev.of)!));
          break;
        case 'release':
          for (const id of varIds(ev.binding)) tr.add(id);
          break;
        case 'bind':
          tr.add(rustClawId(ev.binding)).add(rustValId(ev.value));
          break;
        case 'move':
        case 'return':
          tr.add(rustClawId(ev.from)).add(rustClawId(ev.to)).add(rustValId(held(ev.from)!));
          break;
        case 'copy':
          tr.add(rustClawId(ev.from)).add(rustClawId(ev.to)).add(rustValId(held(ev.from)!)).add(rustValId(ev.value));
          splits.push({ step: i, id: rustValId(ev.value), from: rustValId(held(ev.from)!) });
          break;
        case 'use':
        case 'use-inner':
        case 'mutate': {
          const r = reach(ev.binding);
          const ids = [...varIds(ev.binding), ...(r ? [rustValId(r)] : [])];
          if (before.boxes[ev.binding]) ids.push(rustBoxId(ev.binding));
          for (const id of ids) {
            tr.add(id);
            pulse.add(id);
          }
          break;
        }
        case 'drop': {
          for (const id of varIds(ev.binding)) tr.add(id);
          if (before.boxes[ev.binding]) tr.add(rustBoxId(ev.binding));
          const v = held(ev.binding);
          if (v) tr.add(rustValId(v));
          break;
        }
        case 'wrap':
          tr.add(rustClawId(ev.binding)).add(rustBoxId(ev.binding));
          if (ev.value !== undefined) tr.add(rustValId(ev.value));
          break;
        case 'open': {
          tr.add(rustClawId(ev.binding)).add(rustBoxId(ev.binding));
          const v = held(ev.binding);
          if (v) tr.add(rustValId(v));
          if (ev.to) tr.add(rustClawId(ev.to));
          break;
        }
        case 'match':
          tr.add(rustClawId(ev.on));
          if (before.boxes[ev.on]) tr.add(rustBoxId(ev.on));
          for (const arm of ev.arms) tr.add(gateId('rust', ev.id, arm));
          break;
        case 'arm':
          tr.add(gateId('rust', ev.match, ev.arm));
          pulse.add(gateId('rust', ev.match, ev.arm));
          break;
        case 'end-match': {
          const m = before.matches[ev.match]!;
          for (const arm of m.arms) tr.add(gateId('rust', ev.match, arm));
          // 分支算出來的值從亮著的那道閘門冒出來
          if (ev.yields !== undefined && m.taken !== null)
            splits.push({ step: i, id: rustValId(ev.yields), from: gateId('rust', ev.match, m.taken) });
          break;
        }
        case 'remove-arm':
          break;
        case 'declare-ref':
          tr.add(rustLensId(ev.binding));
          break;
        case 'share': {
          const v = held(ev.from)!;
          for (const id of [...varIds(ev.from), rustClawId(ev.to), rustShareId(ev.to), rustValId(v)]) tr.add(id);
          break;
        }
        case 'cell-borrow':
          tr.add(rustLensId(ev.binding)).add(rustBeamId(ev.binding)).add(rustValId(held(ev.of)!));
          break;
        case 'cell-use': {
          const v = held(ev.via)!;
          for (const id of [...varIds(ev.via), rustValId(v)]) {
            tr.add(id);
            pulse.add(id);
          }
          flashed.push({ step: i, from: rustClawId(ev.via), to: rustValId(v), mut: ev.mut === true });
          break;
        }
        case 'pipe':
          tr.add(rustLensId(ev.binding)).add(rustPipeId(ev.id, 0)).add(rustValId(held(ev.of)!));
          break;
        case 'pipe-extend': {
          const p = before.pipes[ev.pipe]!;
          tr.add(rustLensId(p.holders[p.holders.length - 1]!)).add(rustLensId(ev.to));
          tr.add(rustPipeId(ev.pipe, p.stages.length));
          break;
        }
        case 'collect': {
          const p = before.pipes[ev.pipe]!;
          tr.add(rustLensId(p.holders[p.holders.length - 1]!)).add(rustClawId(ev.to)).add(rustValId(ev.value));
          tr.add(rustPipeId(ev.pipe, 'out'));
          break;
        }
        case 'pull':
          for (const id of pipeIds(ev.pipe)) tr.add(id);
          if (ev.label !== undefined) tr.add(rustValId(before.pipes[ev.pipe]!.sink!));
          pulled.push({ step: i, pipe: ev.pipe, path: ev.path });
          break;
        case 'end-pipe':
          for (const id of pipeIds(ev.pipe)) tr.add(id);
          tr.add(rustValId(before.pipes[ev.pipe]!.source));
          break;
        case 'enter':
          tr.add(rustFrameId(ev.scope));
          break;
        case 'exit':
          tr.add(rustFrameId(ev.scope));
          for (const name of before.scopes[ev.scope]!.bindings) {
            if (before.scopeOf[name] !== ev.scope || before.bindings[name]?.state === 'gone') continue;
            for (const id of varIds(name)) tr.add(id);
            if (before.boxes[name]) tr.add(rustBoxId(name));
            const v = held(name);
            if (v) tr.add(rustValId(v));
          }
          break;
      }
    }
    for (const ev of step.js) {
      const before = js;
      js = applyJs(js, ev);
      const held = (b: string) => before.bindings[b]?.value ?? null;
      switch (ev.type) {
        case 'alloc':
          tj.add(jsOrbId(ev.value));
          break;
        case 'bind':
          tj.add(jsTagId(ev.binding)).add(jsLinkId(ev.binding)).add(jsOrbId(ev.value));
          break;
        case 'copy':
          tj.add(jsTagId(ev.from)).add(jsOrbId(held(ev.from)!));
          tj.add(jsTagId(ev.to)).add(jsLinkId(ev.to)).add(jsOrbId(ev.value));
          splits.push({ step: i, id: jsOrbId(ev.value), from: jsOrbId(held(ev.from)!) });
          break;
        case 'return':
          tj.add(jsTagId(ev.from)).add(jsTagId(ev.to)).add(jsLinkId(ev.to)).add(jsOrbId(held(ev.from)!));
          break;
        case 'use':
        case 'mutate': {
          const ids = [jsTagId(ev.binding), jsLinkId(ev.binding)];
          const v = held(ev.binding);
          if (v) ids.push(jsOrbId(v));
          if (before.holes.includes(ev.binding)) ids.push(jsHoleId(ev.binding));
          for (const id of ids) {
            tj.add(id);
            pulse.add(id);
          }
          break;
        }
        case 'unbind':
          tj.add(jsTagId(ev.binding)).add(jsLinkId(ev.binding)).add(jsHoleId(ev.binding));
          break;
        case 'bind-empty':
          tj.add(jsTagId(ev.binding)).add(jsLinkId(ev.binding)).add(jsHoleId(ev.binding));
          break;
        case 'match':
          tj.add(jsTagId(ev.on));
          for (const arm of ev.arms) tj.add(gateId('js', ev.id, arm));
          break;
        case 'arm':
          tj.add(gateId('js', ev.match, ev.arm));
          pulse.add(gateId('js', ev.match, ev.arm));
          break;
        case 'end-match': {
          const m = before.matches[ev.match]!;
          for (const arm of m.arms) tj.add(gateId('js', ev.match, arm));
          if (m.taken === null) missed.push({ step: i, id: ev.match });
          break;
        }
        case 'throw':
          tj.add(JS_SPARK_ID);
          if (ev.binding !== undefined) {
            for (const id of [jsTagId(ev.binding), jsLinkId(ev.binding), jsHoleId(ev.binding)]) {
              tj.add(id);
              pulse.add(id);
            }
          }
          break;
        case 'unwind': {
          tj.add(JS_SPARK_ID).add(jsBoltId(js.error!.trail.length - 1 + (js.error!.out ? 1 : 0)));
          const at = before.stack[before.stack.length - 1]!;
          if (at !== ROOT) {
            tj.add(jsFrameId(at));
            for (const name of before.scopes[at]!.bindings) {
              if (before.scopeOf[name] === at && before.bindings[name]?.live) tj.add(jsTagId(name)).add(jsLinkId(name));
            }
          }
          break;
        }
        case 'enter':
          tj.add(jsFrameId(ev.scope));
          break;
        case 'exit':
          tj.add(jsFrameId(ev.scope));
          for (const name of before.scopes[ev.scope]!.bindings) {
            if (before.scopeOf[name] !== ev.scope || !before.bindings[name]?.live) continue;
            tj.add(jsTagId(name)).add(jsLinkId(name));
          }
          break;
        case 'gc':
          tj.add(JS_GC_ID);
          for (const id of Object.keys(before.values)) {
            if (js.values[id]) continue;
            tj.add(jsOrbId(id));
            swept.push(jsOrbId(id));
          }
          break;
      }
    }
    rustStates.push(rust);
    jsStates.push(js);
    touched.push({ js: [...tj], rust: [...tr] });
    pulses.push([...pulse]);
    collected.push(swept);
  });

  // 範圍的紀錄只增不減，所以最後一個狀態就有整條軌跡的排版資訊
  const plan = makePlan(rust, js.scopes, orbs);
  const frames = rustStates.map((r, k) => {
    const frame = layoutRust(r, plan);
    for (const [id, v] of layoutJs(jsStates[k]!, plan)) frame.set(id, v);
    return frame;
  });

  const origins: Record<string, Pt>[] = trace.steps.map(() => ({}));
  for (const s of splits) {
    const src = frames[s.step]!.get(s.from);
    if (src) origins[s.step]![s.id] = { x: src.n.x, y: src.n.y };
  }

  // 同一步 throw 完又往上飛：閃電的頭從丟出錯誤的地方出發，不是在終點原地淡入
  trace.steps.forEach((step, i) => {
    if (!step.js.some((ev) => ev.type === 'throw')) return;
    const first = frames[i + 1]!.get(jsBoltId(1));
    if (first) origins[i]![JS_SPARK_ID] = { x: first.n.x, y: first.n.y };
  });

  const sweeps = trace.steps.map((step, i): Sweep | null => {
    if (!step.js.some((ev) => ev.type === 'gc')) return null;
    // 同一步才配置就被收走的值不在起點快照裡，沒有東西可演
    const ids = collected[i]!.filter((id) => frames[i]!.has(id));
    const xs = ids.map((id) => frames[i]!.get(id)!.n.x);
    return {
      y: plan.jsFree.y,
      x0: Math.min(-HALF_X, ...xs.map((x) => x - 0.6)),
      x1: Math.max(HALF_X, ...xs.map((x) => x + 0.6)),
      ids,
    };
  });

  const slips: (Slip | null)[] = trace.steps.map(() => null);
  for (const miss of missed) {
    const before = jsStates[miss.step]!;
    const m = before.matches[miss.id]!;
    const gates = m.arms.map((arm) => frames[miss.step]!.get(gateId('js', miss.id, arm))!.n);
    const first = gates[0];
    if (!first) continue;
    // 從值的位置出發，穿過閘門那一排沒有人接的地方，往右上飛走
    slips[miss.step] = {
      from: { x: first.x2, y: first.y2 },
      to: { x: Math.min(HALF_X - 0.35, Math.max(...gates.map((g) => g.x)) + 0.85), y: first.y + 0.9 },
    };
  }

  const flashes: Flash[][] = trace.steps.map(() => []);
  for (const fl of flashed) {
    const from = frames[fl.step]!.get(fl.from);
    if (from) flashes[fl.step]!.push({ from: { x: from.n.x, y: from.n.y }, to: fl.to, mut: fl.mut });
  }

  const flows: (Flow | null)[] = trace.steps.map(() => null);
  for (const pl of pulled) {
    const geo = plan.rustPipe(pl.pipe);
    // 走完全程的流進出口；被擋下的停在擋住它的那一段
    const through = pl.path.length === geo.nodes.length + 1;
    flows[pl.step] = {
      points: [geo.inlet, ...geo.nodes.slice(0, pl.path.length), ...(through && geo.outlet ? [geo.outlet] : [])],
      labels: pl.path,
    };
  }

  let reachX = 0;
  for (const frame of frames) {
    for (const v of frame.values()) reachX = Math.max(reachX, labelReach(v));
  }

  return {
    steps: trace.steps.length, frames, touched, pulses, origins, sweeps, slips, flashes, flows,
    bounds: plan.bounds, reachX, rustStates, jsStates,
  };
}

const easeInOut = (f: number) => (f < 0.5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** 飛行途中抬高多少；不會飛的種類是 0 */
const liftOf = (kind: VisualKind) => (kind === 'crystal' || kind === 'chip' ? LIFT : kind === 'bead' ? LIFT * 0.5 : 0);

/** 時間 t（0..N，可帶小數）的畫面。純函式：同一個 t 永遠得到同一個畫面。 */
export function stateAt(tl: Timeline, t: number): Visual[] {
  const tc = Math.min(Math.max(t, 0), tl.steps);
  const k = Math.min(Math.floor(tc), Math.max(tl.steps - 1, 0));
  const f = tl.steps === 0 ? 0 : tc - k;
  const e = easeInOut(f);
  const a = tl.frames[k]!;
  const b = tl.frames[Math.min(k + 1, tl.steps)]!;
  // 內插到底（只會發生在 t = N）：直接取終點快照的數值，不經過浮點運算
  const done = f >= 1;
  const mid = f > 0 && !done;
  const pulsing = mid ? (tl.pulses[k] ?? []) : [];
  const origins = tl.origins[k] ?? {};
  const sweep = mid ? (tl.sweeps[k] ?? null) : null;
  const sweepX = sweep ? sweep.x0 + (sweep.x1 - sweep.x0) * e : 0;
  const flashes = mid ? (tl.flashes[k] ?? []) : [];
  const out: Visual[] = [];

  for (const id of new Set([...a.keys(), ...b.keys()])) {
    const va = a.get(id);
    const vb = b.get(id);
    const base = (vb ?? va)!;
    // 這一步才出現的物件：預設在原地淡入；有 origin 的從 origin 的位置分出來
    const origin = va ? undefined : origins[id];
    const from = va?.n ?? { ...base.n, alpha: 0, grow: 0, lit: 0, ...origin };
    const to = vb?.n ?? { ...base.n, alpha: 0, grow: 0, lit: 0 };
    const n = zero();
    for (const key of NUM_KEYS) n[key] = done ? to[key] : from[key] + (to[key] - from[key]) * e;
    if (!done) {
      const lift = liftOf(base.kind);
      if (lift > 0 && vb && (va || origin) && (from.x !== to.x || from.y !== to.y)) {
        n.flight = Math.sin(Math.PI * e);
        n.y += lift * n.flight;
      }
      // 分出來的值一離開原值就要看得見，不等到飛抵才淡入完
      if (origin) n.alpha = to.alpha * Math.min(1, e * 3);
      if (sweep && sweep.ids.includes(id)) {
        // 被 GC 收走的 orb：掃地機掃到之前維持原樣，掃過才消失
        n.alpha = from.alpha;
        n.loose = from.loose;
        n.swept = clamp01(sweepX - from.x + 0.5);
      }
    }
    if (pulsing.includes(id)) n.pulse = Math.sin(Math.PI * f);
    // 一行之內借了就還：RefCell 的殼只在這一步中途亮一下
    const flash = flashes.find((fl) => fl.to === id);
    if (flash) {
      n.lent = Math.max(n.lent, Math.sin(Math.PI * f));
      if (flash.mut) n.solid = Math.max(n.solid, Math.sin(Math.PI * f));
    }
    // 標籤不能內插：改值（mutate）那一步演到一半才換成新的，整數 t 永遠是該張快照的標籤
    const shown = (f < 0.5 ? (va ?? vb) : (vb ?? va))!;
    const visual: Visual = { ...base, label: shown.label, n };
    // 計數的數字跟著標籤一起換
    if (shown.count !== undefined) visual.count = shown.count;
    out.push(visual);
  }

  const slip = mid ? (tl.slips[k] ?? null) : null;
  if (slip) {
    // 沒有 case 接住的值：一顆淡淡的影子從閘門旁邊溜過去，兩頭都看不見
    const n = zero();
    n.x = slip.from.x + (slip.to.x - slip.from.x) * e;
    n.y = slip.from.y + (slip.to.y - slip.from.y) * e;
    n.alpha = Math.sin(Math.PI * f) * 0.75;
    out.push({ id: JS_SLIP_ID, world: 'js', kind: 'bead', label: '', ref: null, n });
  }

  flashes.forEach((fl, i) => {
    const target = a.get(fl.to) ?? b.get(fl.to);
    if (!target) return;
    const n = zero();
    n.x = fl.from.x;
    n.y = fl.from.y;
    n.x2 = target.n.x;
    n.y2 = target.n.y;
    n.alpha = 1;
    n.lit = Math.sin(Math.PI * f);
    n.solid = fl.mut ? 1 : 0;
    n.r1 = 1;
    out.push({ id: `rust:flash:${i}`, world: 'rust', kind: 'beam', label: '', ref: fl.to, n });
  });

  const flow = mid ? (tl.flows[k] ?? null) : null;
  if (flow && flow.points.length > 1) {
    // 流過管線的值：每一段路花一樣久，兩頭淡入淡出；被擋下的就停在擋住它的節點上消失
    const legs = flow.points.length - 1;
    const u = e * legs;
    const j = Math.min(Math.floor(u), legs - 1);
    const from = flow.points[j]!;
    const to = flow.points[j + 1]!;
    const n = zero();
    n.x = from.x + (to.x - from.x) * (u - j);
    n.y = from.y + (to.y - from.y) * (u - j);
    n.alpha = Math.min(1, Math.sin(Math.PI * f) * 4);
    out.push({ id: RUST_FLOW_ID, world: 'rust', kind: 'item', label: flow.labels[j] ?? '', ref: null, n });
  }

  if (sweep) {
    const n = zero();
    n.x = sweepX;
    n.y = sweep.y;
    n.x2 = sweep.x0;
    n.y2 = sweep.y;
    n.alpha = Math.min(1, Math.sin(Math.PI * f) * 4);
    out.push({ id: JS_GC_ID, world: 'js', kind: 'sweeper', label: 'GC', ref: null, n });
  }
  return out;
}

export type Lang = 'rust' | 'ts';

/** 滑到程式碼某一行時，場景裡要發亮的物件 */
export function idsForLine(tl: Timeline, trace: Trace, lang: Lang, line: number): string[] {
  const ids = new Set<string>();
  trace.steps.forEach((step, i) => {
    if ((lang === 'rust' ? step.rustLine : step.tsLine) !== line) return;
    for (const id of tl.touched[i]![lang === 'rust' ? 'rust' : 'js']) ids.add(id);
  });
  return [...ids];
}

/** 指到場景某個物件時，程式碼要發亮的行 */
export function linesForId(tl: Timeline, trace: Trace, id: string): { lang: Lang; lines: number[] } {
  const rust = id.startsWith('rust:');
  const lines = new Set<number>();
  trace.steps.forEach((step, i) => {
    if (!tl.touched[i]![rust ? 'rust' : 'js'].includes(id)) return;
    const line = rust ? step.rustLine : step.tsLine;
    if (line !== null) lines.add(line);
  });
  return { lang: rust ? 'rust' : 'ts', lines: [...lines].sort((p, q) => p - q) };
}

/** 「弄壞它」在哪一段時間可以做：嘗試的事件會被規則擋下的那幾步（含頭尾），沒有就是 null */
export function breakRange(tl: Timeline, breakIt: BreakIt): { from: number; to: number } | null {
  const ks = tl.rustStates
    .map((s, k) => (checkRust(s, breakIt.attempt)?.rule === breakIt.rule ? k : -1))
    .filter((k) => k >= 0);
  return ks.length ? { from: ks[0]!, to: ks[ks.length - 1]! } : null;
}
