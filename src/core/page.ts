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
  trace: Trace;
  breakIt: BreakIt | null;
  verified: Verified;
}

export interface PageEntry {
  slug: string;
  title: string;
  load: () => Promise<Page>;
}
