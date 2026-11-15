import type { BreakIt, Trace } from './trace.ts';

/** scripts/verify-rust.mjs 寫出的 rustc 實測結果（每頁一份 verified.json） */
export interface VerifiedFile {
  sha256: string;
  /** 'pass' 或 rustc 錯誤碼，例如 'E0382' */
  expect: string;
  success: boolean;
  /** rustc 錯誤訊息原文（只取 error 區塊）；編譯通過時是空字串 */
  message: string;
  stdout: string;
  stderr: string;
}

export interface Verified {
  /** rustc 版本，例如 '1.100.0' */
  rustc: string;
  checkedAt: string;
  files: Record<string, VerifiedFile>;
}

export interface Page {
  slug: string;
  /** 所屬的區，例如「所有權 · Rust Book 第 4 章」 */
  kicker: string;
  title: string;
  /** 白話解釋，一段一個字串 */
  lead: string[];
  book: {
    /** Rust Book 原文，一句一個字串 */
    quote: string[];
    cite: string;
    url: string;
    urlZh: string;
  };
  /** 程式碼原文 */
  rust: string;
  ts: string;
  /** 英文版的程式碼（只有註解與字串不同，行號完全相同）；片段裡沒有中文的頁省略，英文模式用原文 */
  rustEn?: string;
  tsEn?: string;
  /** 這一頁的英文內容，跟著這一頁一起載入；用 core/localize.ts 的 localizePage 套上去 */
  en?: PageEn;
  trace: Trace;
  breakIt: BreakIt | null;
  verified: Verified;
}

export interface PageEntry {
  slug: string;
  title: string;
  load: () => Promise<Page>;
}

/**
 * 一頁的英文內容（各頁資料夾裡的 en.ts，default export）。中文是原文，放在 index.ts 與 trace.ts；
 * 英文只覆蓋「顯示給讀者的文字」，程式碼、軌跡事件、rustc 訊息、Rust Book 引文都共用。
 */
export interface PageEn {
  kicker: string;
  title: string;
  lead: string[];
  /** 與 trace.steps 一一對應，長度必須相同 */
  captions: { js: string; rust: string }[];
  /** 該頁有「弄壞它」才有 */
  breakIt?: { hint: string; plain: string };
  /** 舞台上出現的中文標籤（值的標籤、框的名字等）→ 英文。鍵是軌跡裡的原字串；沒有中文標籤就省略 */
  labels?: Record<string, string>;
}
