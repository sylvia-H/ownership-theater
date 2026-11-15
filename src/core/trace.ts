// 軌跡的型別。畫面從軌跡算出來，不從解析程式碼算出來。
// 每一步對應兩邊各一行程式碼，以及兩個世界各自發生的事件。

/** 進入一個範圍：函式呼叫（fn）或內層的 `{ }`（block）。兩個世界共用。 */
export interface EnterEvent {
  type: 'enter';
  /** 範圍的 id，整條軌跡內不能重複（同一個函式呼叫兩次要給兩個 id） */
  scope: string;
  kind: 'fn' | 'block';
  /** 畫在框上的名字，例如 `fn pass`、`{ }` */
  label: string;
}

/** 離開最內層的範圍。scope 必須是目前最內層那一個。 */
export interface ExitEvent {
  type: 'exit';
  scope: string;
}

/**
 * 試一道閘門（match 的一個分支、switch 的一個 case），照程式碼的順序一道一道試。
 * 符不符合由世界自己算（arm 等於被比對的值目前的變體／標籤才符合）：符合的那道亮起，不符合的變暗。
 * 已經有一道符合之後不能再試。兩個世界共用。
 */
export interface ArmEvent {
  type: 'arm';
  match: string;
  arm: string;
}

export type RustEvent =
  /**
   * copy: true 表示這個值的型別是 Copy（整數、bool、char…）；預設是 Move 型別。
   * rc: true 是包在 `Rc` 裡的值：可以有很多個擁有者（share），第一個擁有者照樣用 bind。
   * cell: true 是包在 `RefCell` 裡的值：借用改在執行期登記（cell-borrow、cell-use）。兩個可以同時給。
   */
  | { type: 'alloc'; value: string; label: string; copy?: boolean; rc?: boolean; cell?: boolean }
  | { type: 'bind'; binding: string; value: string }
  /** Move 型別的指定：值整顆搬到 to，from 變空殼。to 宣告在目前最內層的範圍。 */
  | { type: 'move'; from: string; to: string }
  /** Copy 型別的指定：複製出一顆新的值（id 是 value）給 to，from 仍握著原值、仍可用 */
  | { type: 'copy'; from: string; to: string; value: string }
  | { type: 'use'; binding: string }
  /** 變數離開 scope：握著值的話值當場碎掉，空殼則直接消失 */
  | { type: 'drop'; binding: string }
  | EnterEvent
  /** 範圍結束：裡面宣告的變數照宣告的反序 drop，還握著的值當場碎掉 */
  | ExitEvent
  /** 回傳：值從函式內的 from 搬到呼叫端的 to（to 宣告在最內層函式範圍的外面一層）。之後要接 exit。 */
  | { type: 'return'; from: string; to: string }
  /**
   * 借用：binding 是參考變數（不握值，發出一道光束），照著 of 這個擁有者握著的值。
   * mut: true 是 `&mut`（唯一一道實心光束），預設是 `&`（半透明，可以同時很多道）。
   * part 是 slice：只照到值的一段，[起點, 終點] 都是 0..1 的比例（`&s[0..5]`、s 長 11 就是 [0, 5 / 11]）。
   * binding 宣告在目前最內層的範圍；先用 declare-ref 宣告過的（`let result;`）留在原本宣告的範圍。
   * tied 是生命週期：函式簽名把這道參考和哪些擁有者的值綁在一起（`longest<'a>(&a, &b)` 回傳的參考綁著 a 與 b），
   * 它實際照著 of，但不能活得比 tied 裡任何一個值久（outlives-value）。life 是畫在綁線上的名字，預設 `'a`。
   */
  | {
      type: 'borrow'; binding: string; of: string; mut?: boolean; part?: [number, number];
      tied?: string[]; life?: string;
    }
  /** 先宣告、還沒指定的參考變數（`let result;`）：一盞沒亮的燈，宣告在目前最內層的範圍。之後用 borrow 指定。 */
  | { type: 'declare-ref'; binding: string }
  /** 借用結束：光束熄滅（最後一次使用之後）。參考變數還在 scope 裡，只是不再照著值。 */
  | { type: 'release'; binding: string }
  /**
   * 改值：值的標籤換成 label（同一顆值，不是新值）。
   * binding 是參考變數時必須是亮著的 `&mut`；是擁有者時值不能有任何亮著的借用。
   */
  | { type: 'mutate'; binding: string; label: string }
  /**
   * 回傳一道 `&`：呼叫端的 to 照著 of 握著的值。of 是函式自己的區域變數就會被 dangling-ref 擋下
   *（函式結束時值就碎了）。之後要接 exit。
   */
  | { type: 'return-ref'; of: string; to: string }
  /**
   * 盒子（enum 包住值）：binding 握住一個盒子，variant 是盒子這次的變體（`Some`、`None`、`Ok`、`Err`）。
   * value 是裝在裡面的值（先 alloc、還沒有擁有者）；空盒（`None`）不給 value。
   * side 有給就是 `Result` 的雙色盒子，值是這次亮哪一色；沒給是 `Option` 的單色盒子。
   * 盒子不是裡面的值：沒打開之前，裡面的值不能直接用（use-inner 會被 unopened-box 擋下）。
   * 握著盒子的變數不能 move／copy／return／borrow（還沒有支援）。
   */
  | { type: 'wrap'; binding: string; variant: string; value?: string; side?: 'ok' | 'err' }
  /**
   * 打開盒子（`if let`、match 的分支繫結）：裡面有值就整顆搬給 to（宣告在目前最內層的範圍），
   * binding 變空殼；空盒沒有東西可以交，不能給 to。match 已經把盒子掀開時，這個事件只負責把值交出去。
   */
  | { type: 'open'; binding: string; to?: string }
  /**
   * 把 binding 當成盒子裡面的值來用（`b.to_uppercase()`、`result + 1`）。
   * binding 握的是還沒打開的盒子就被 unopened-box 擋下（E0599／E0369 這類型別錯誤）；
   * 握的是一般的值就等於 use。主要給「弄壞它」用。
   */
  | { type: 'use-inner'; binding: string }
  /**
   * match：對 on 握著的東西（盒子看變體、一般的值看標籤）立起一排閘門，arms 是寫出來的分支，
   * of 是這個型別所有的可能。arms 沒有涵蓋 of 就被 non-exhaustive-match 擋下（E0004）。
   * on 握的是盒子時，match 會把盒子掀開（看得到是哪個變體），值還在裡面，要再用 open 交給分支的變數。
   */
  | { type: 'match'; id: string; on: string; arms: string[]; of: string[] }
  | ArmEvent
  /**
   * match 結束：閘門收掉。yields 是走進的那個分支算出來的值（同一步先 alloc 並 bind 好），
   * 畫面上從亮著的那道閘門冒出來。必須已經有一道閘門符合。
   */
  | { type: 'end-match'; match: string; yields?: string }
  /**
   * 從進行中的 match 拔掉一個分支。只給「弄壞它」用：拔掉之後分支不齊，永遠被 non-exhaustive-match 擋下，
   * 所以不會出現在合法的軌跡裡。
   */
  | { type: 'remove-arm'; match: string; arm: string }
  /**
   * 共享擁有（`Rc::clone(&from)`）：to 成為同一個值的另一個擁有者，計數加一；值沒有被複製，from 仍然有效。
   * from 必須是 Rc 值的擁有者（alloc 時 rc: true）。to 宣告在目前最內層的範圍。
   * 擁有者離開（drop、範圍結束）計數減一，歸零的那一刻值才碎掉。
   */
  | { type: 'share'; from: string; to: string }
  /**
   * 執行期借用（`let w = cell.borrow_mut();`）：binding 是守衛變數，畫成一盞燈加一道光束，照著 of 握著的 RefCell 值
   *（of 是擁有者或 Rc 的擁有者之一）。規則和編譯期一樣（一道 &mut，或很多道 &），但到執行時才登記：
   * 違規被 refcell-already-borrowed 擋下，那是 panic，不是編譯錯誤。
   * 守衛有 Drop，不適用 NLL：不能 release，要 drop（或離開範圍）才歸還。
   */
  | { type: 'cell-borrow'; binding: string; of: string; mut?: boolean }
  /**
   * 一行之內借了就還的執行期借用（`b.borrow_mut().push(3)`、`a.borrow()`）：守衛是暫時值，這一行結束就歸還，
   * 所以快照裡沒有光束，只在這一步的中途閃一下。label 有給就是透過它改值（必須 mut: true）。
   */
  | { type: 'cell-use'; via: string; mut?: boolean; label?: string }
  /**
   * 管線的第一段（`v.iter().map(…)`）：binding 握著一條管線（id），源頭借著 of 握著的值，stage 是這一段的名字。
   * 管線是惰性的：接上去的時候沒有任何值流過、也沒有新值產生。
   */
  | { type: 'pipe'; id: string; binding: string; of: string; stage: string }
  /** 再接一段（`doubled.filter(…)`）：管線搬給 to，原本握著它的變數成了空殼。仍然沒有值流過。 */
  | { type: 'pipe-extend'; pipe: string; to: string; stage: string }
  /**
   * 開始要結果（`.collect()`）：管線被消耗（握著它的變數成了空殼），出口接到 to 握著的新值（id 是 value，
   * label 是一開始空的樣子，例如 `[]`）。之後才可以 pull。
   */
  | { type: 'collect'; pipe: string; to: string; value: string; label: string }
  /**
   * 一個值流過管線。path 是它一路上的樣子：path[0] 是從源頭出來時，path[i] 是通過第 i 段之後；
   * 比段數加一短表示它在第 path.length 段被擋下（filter）。走完全程的要給 label：產出的值收下它之後的樣子。
   * 還沒 collect 就 pull 不合法（沒有人要結果，值不會流）。
   */
  | { type: 'pull'; pipe: string; path: string[]; label?: string }
  /** 源頭的值都流完了：管線消失，對源頭的借用結束。 */
  | { type: 'end-pipe'; pipe: string };

export type JsEvent =
  /** prim: true 表示 primitive（數字、字串、布林）：指定時複製，跟著變數走，不歸 GC 管 */
  | { type: 'alloc'; value: string; label: string; prim?: boolean }
  /** 變數連一條線到值；同一顆物件可以被很多條線連著（primitive 只能有一個變數） */
  | { type: 'bind'; binding: string; value: string }
  /** primitive 的指定：複製出一顆新的值（id 是 value）給 to */
  | { type: 'copy'; from: string; to: string; value: string }
  | { type: 'use'; binding: string }
  /** 變數離開 scope：線消失。物件留在原地等 GC；primitive 跟著變數一起消失 */
  | { type: 'unbind'; binding: string }
  | EnterEvent
  /** 範圍結束：裡面宣告的變數全部 unbind */
  | ExitEvent
  /** GC 經過：沒有任何線連著的物件被收走 */
  | { type: 'gc' }
  /** 透過 binding 這條線改值：值的標籤換成 label，連著同一顆值的其他線看到的也跟著變 */
  | { type: 'mutate'; binding: string; label: string }
  /** 回傳：呼叫端的 to 連到 from 連著的那顆值（to 宣告在最內層函式範圍的外面一層）。之後要接 exit。 */
  | { type: 'return'; from: string; to: string }
  /** 變數連到空位（`undefined`）：線照樣拉出去，另一頭是一個空的虛線圈。之後可以再 bind 到真的值。 */
  | { type: 'bind-empty'; binding: string }
  /** switch：對 on 連著的值（看標籤；空位是 `undefined`）立起一排閘門，arms 是寫出來的 case。漏了也不會被擋。 */
  | { type: 'match'; id: string; on: string; arms: string[] }
  | ArmEvent
  /** switch 結束：閘門收掉。沒有任何一道符合時，值從閘門旁邊溜過去，什麼都沒發生。 */
  | { type: 'end-match'; match: string }
  /**
   * 丟出錯誤：閃電的起點。binding 有給表示「碰了空位才炸」（binding 必須連著空位），起點在那個空位；
   * 沒給就是目前最內層的範圍自己 throw，起點在它的框上方。同一時間只能有一個錯誤在飛。
   */
  | { type: 'throw'; label: string; binding?: string }
  /**
   * 錯誤往上飛一層（沒有人 catch）：目前最內層的範圍被劈穿、當場結束（裡面的變數全部 unbind），
   * 閃電到達外面那一層。已經在最外層時就是劈出頂端，程式中止，之後不能再有任何 JS 事件。
   */
  | { type: 'unwind' };

export interface Step {
  /** 這一步對應的程式碼行（1 起算）；該語言沒有對應的行就是 null */
  rustLine: number | null;
  tsLine: number | null;
  caption: { js: string; rust: string };
  js: JsEvent[];
  rust: RustEvent[];
}

export interface Trace {
  steps: Step[];
}

/** 每頁固定一個「把它弄壞」的動作：在 Rust 世界嘗試一個會被擋下的事件 */
export interface BreakIt {
  attempt: RustEvent;
  /** 這個嘗試應該被哪一條規則擋下（worlds.ts 的 RustRule） */
  rule: string;
  /** expect.json 裡 broken.rs 的值：rustc 錯誤碼（例如 E0382），或 panic（編譯會過，執行時才炸） */
  expect: string;
  hint: string;
  plain: string;
  /** 力場出現在哪個畫面物件上（Visual.id） */
  at: string;
  /** 可以用拖的才有：拖哪個值（Rust 的值 id）、拖向哪個變數 */
  drag?: { value: string; onto: string };
}
