import type { Page, Verified } from '../../core/page.ts';
import rust from './snippet.rs?raw';
import ts from './snippet.ts?raw';
import { breakIt, trace } from './trace.ts';
import verifiedJson from './verified.json';

// verified.json 由 scripts/verify-rust.mjs 產生；形狀跑掉的話這一行會在型別檢查時失敗。
const verified: Verified = verifiedJson;

const page: Page = {
  slug: 'nll',
  kicker: '借用 · Rust Book 第 4 章',
  title: '借用在最後一次使用後結束',
  lead: [
    'JS 的線會一直連到變數離開 scope 為止，中間沒有「用完了」這回事，也不需要有，因為本來就沒有借用規則。',
    'Rust 的借用只活到最後一次使用。r1、r2 印完就熄滅，不必等到大括號結尾，所以下一行就能借出 &mut，不算衝突。',
  ],
  book: {
    quote: [
      'Note that a reference’s scope starts from where it is introduced and continues through the last time that reference is used.',
      'These scopes don’t overlap, so this code is allowed: The compiler can tell that the reference is no longer being used at a point before the end of the scope.',
    ],
    cite: 'The Rust Programming Language §4.2 Mutable References',
    url: 'https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html#mutable-references',
    urlZh: 'https://rust-lang.tw/book-tw/ch04-02-references-and-borrowing.html',
  },
  rust,
  ts,
  trace,
  breakIt,
  verified,
};

export default page;
