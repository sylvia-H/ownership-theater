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
  slug: 'lifetimes',
  kicker: '生命週期 · Rust Book 第 10 章',
  title: "'a：回傳的參考能活多久",
  lead: [
    'JS 的參考沒有期限：只要還有一條線連著，值就留在那裡。函式回傳哪個參數的參考都行，沒有人需要知道它還能用多久。',
    'Rust 的每道參考都有一段有效範圍，叫生命週期。函式回傳參考時，要標明它和哪些輸入綁在一起；編譯器照其中最短的來算，不讓它比指向的值活得久。',
  ],
  book: {
    quote: [
      "The function signature also tells Rust that the string slice returned from the function will live at least as long as lifetime 'a.",
      'In practice, it means that the lifetime of the reference returned by the longest function is the same as the smaller of the lifetimes of the values referred to by the function arguments.',
    ],
    cite: 'The Rust Programming Language §10.3 Validating References with Lifetimes',
    url: 'https://doc.rust-lang.org/book/ch10-03-lifetime-syntax.html#in-function-signatures',
    urlZh: 'https://rust-lang.tw/book-tw/ch10-03-lifetime-syntax.html',
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
