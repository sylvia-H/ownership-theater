import type { Page, Verified } from '../../core/page.ts';
import en from './en.ts';
import tsEn from './snippet.en.ts?raw';
import rust from './snippet.rs?raw';
import ts from './snippet.ts?raw';
import { breakIt, trace } from './trace.ts';
import verifiedJson from './verified.json';

// verified.json 由 scripts/verify-rust.mjs 產生；形狀跑掉的話這一行會在型別檢查時失敗。
const verified: Verified = verifiedJson;

const page: Page = {
  slug: 'refcell',
  kicker: '智慧指標 · Rust Book 第 15 章',
  title: 'RefCell<T>：借用規則改到執行期檢查',
  lead: [
    'JS 沒有借用規則，拿得到值的人都能改，不用先登記，也不用歸還。',
    'RefCell 把 Rust 的借用規則從編譯期搬到執行期：要改先用 borrow_mut 登記，用完歸還。沒歸還又登記一次，編譯會過，執行時才 panic。',
  ],
  book: {
    quote: [
      'With RefCell<T>, these invariants are enforced at runtime.',
      'With references, if you break these rules, you’ll get a compiler error.',
      'With RefCell<T>, if you break these rules, your program will panic and exit.',
    ],
    cite: 'The Rust Programming Language §15.5 RefCell<T> and the Interior Mutability Pattern',
    url: 'https://doc.rust-lang.org/book/ch15-05-interior-mutability.html#enforcing-borrowing-rules-at-runtime',
    urlZh: 'https://rust-lang.tw/book-tw/ch15-05-interior-mutability.html',
  },
  rust,
  ts,
  tsEn,
  en,
  trace,
  breakIt,
  verified,
};

export default page;
