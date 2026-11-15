import type { Page, Verified } from '../../core/page.ts';
import en from './en.ts';
import rust from './snippet.rs?raw';
import ts from './snippet.ts?raw';
import { breakIt, trace } from './trace.ts';
import verifiedJson from './verified.json';

// verified.json 由 scripts/verify-rust.mjs 產生；形狀跑掉的話這一行會在型別檢查時失敗。
const verified: Verified = verifiedJson;

const page: Page = {
  slug: 'scope-drop',
  kicker: '所有權 · Rust Book 第 4 章',
  title: '離開 { } 的那一刻',
  lead: [
    '在 Rust 裡，值的壽命跟著擁有它的變數走。變數離開宣告它的 { } 那一刻，值就當場被丟棄，記憶體馬上歸還。這個動作叫 drop。',
    '在 JS 裡，離開 { } 只是變數的線斷了，值還留在記憶體裡，要等垃圾回收器（GC）不知何時經過才收走。Rust 沒有 GC，靠的就是這條規則。',
  ],
  book: {
    quote: [
      'When a variable goes out of scope, Rust calls a special function for us.',
      'This function is called drop, and it’s where the author of String can put the code to return the memory.',
      'Rust calls drop automatically at the closing curly bracket.',
    ],
    cite: 'The Rust Programming Language §4.1 Memory and Allocation',
    url: 'https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html#memory-and-allocation',
    urlZh: 'https://rust-lang.tw/book-tw/ch04-01-what-is-ownership.html',
  },
  rust,
  ts,
  en,
  trace,
  breakIt,
  verified,
};

export default page;
