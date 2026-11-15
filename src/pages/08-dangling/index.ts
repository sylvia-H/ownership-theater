import type { Page, Verified } from '../../core/page.ts';
import en from './en.ts';
import rust from './snippet.rs?raw';
import ts from './snippet.ts?raw';
import { breakIt, trace } from './trace.ts';
import verifiedJson from './verified.json';

// verified.json 由 scripts/verify-rust.mjs 產生；形狀跑掉的話這一行會在型別檢查時失敗。
const verified: Verified = verifiedJson;

const page: Page = {
  slug: 'dangling',
  kicker: '借用 · Rust Book 第 4 章',
  title: '回傳區域變數的參考',
  lead: [
    '在 JS 裡，函式回傳區域物件沒有問題：只要還有線連著，GC 就不會收走它。線不會連到已經消失的東西。',
    '在 Rust 裡，區域變數在函式結束時就碎掉，指向它的參考會懸空，所以編譯期就擋下來。要把值帶出去，就把所有權交出去。',
  ],
  book: {
    quote: [
      'In Rust, by contrast, the compiler guarantees that references will never be dangling references: If you have a reference to some data, the compiler will ensure that the data will not go out of scope before the reference to the data does.',
      'References must always be valid.',
    ],
    cite: 'The Rust Programming Language §4.2 Dangling References',
    url: 'https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html#dangling-references',
    urlZh: 'https://rust-lang.tw/book-tw/ch04-02-references-and-borrowing.html',
  },
  rust,
  ts,
  en,
  trace,
  breakIt,
  verified,
};

export default page;
