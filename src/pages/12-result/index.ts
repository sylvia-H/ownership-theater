import type { Page, Verified } from '../../core/page.ts';
import rust from './snippet.rs?raw';
import ts from './snippet.ts?raw';
import { breakIt, trace } from './trace.ts';
import verifiedJson from './verified.json';

// verified.json 由 scripts/verify-rust.mjs 產生；形狀跑掉的話這一行會在型別檢查時失敗。
const verified: Verified = verifiedJson;

const page: Page = {
  slug: 'result',
  kicker: '錯誤處理 · Rust Book 第 9 章',
  title: 'throw 與 Result<T, E>',
  lead: [
    'JS 的函式出錯時用 throw，錯誤沿著 call stack 一路往上飛，直到有人 catch。型別看不出函式會不會丟錯，呼叫者忘了接也沒有提醒。',
    'Rust 沒有例外。可能失敗的函式回傳 Result 這個盒子：Ok 裝著結果，Err 裝著錯誤。呼叫者得先拆開盒子、兩種情況都處理，才拿得到值。',
  ],
  book: {
    quote: [
      'Rust doesn’t have exceptions.',
      'Instead, it has the type Result<T, E> for recoverable errors and the panic! macro that stops execution when the program encounters an unrecoverable error.',
      'In many cases, Rust requires you to acknowledge the possibility of an error and take some action before your code will compile.',
    ],
    cite: 'The Rust Programming Language §9 Error Handling',
    url: 'https://doc.rust-lang.org/book/ch09-00-error-handling.html#error-handling',
    urlZh: 'https://rust-lang.tw/book-tw/ch09-00-error-handling.html',
  },
  rust,
  ts,
  trace,
  breakIt,
  verified,
};

export default page;
