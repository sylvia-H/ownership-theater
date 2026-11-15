import type { Page, Verified } from '../../core/page.ts';
import rust from './snippet.rs?raw';
import ts from './snippet.ts?raw';
import { breakIt, trace } from './trace.ts';
import verifiedJson from './verified.json';

// verified.json 由 scripts/verify-rust.mjs 產生；形狀跑掉的話這一行會在型別檢查時失敗。
const verified: Verified = verifiedJson;

const page: Page = {
  slug: 'functions',
  kicker: '所有權 · Rust Book 第 4 章',
  title: '傳進函式、從函式回傳',
  lead: [
    '在 JS 裡把陣列或物件傳進函式，參數只是多一條線，連到同一顆值；函式結束後，外面的變數照樣能用它。',
    '在 Rust 裡，傳進函式和指定給另一個變數是同一件事：值搬進參數，原變數變成空殼。函式結束時沒回傳的值會被丟棄；回傳，才是把值搬回呼叫端。',
  ],
  book: {
    quote: [
      'The mechanics of passing a value to a function are similar to those when assigning a value to a variable.',
      'Passing a variable to a function will move or copy, just as assignment does.',
      'Returning values can also transfer ownership.',
    ],
    cite: 'The Rust Programming Language §4.1 Ownership and Functions',
    url: 'https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html#ownership-and-functions',
    urlZh: 'https://rust-lang.tw/book-tw/ch04-01-what-is-ownership.html',
  },
  rust,
  ts,
  trace,
  breakIt,
  verified,
};

export default page;
