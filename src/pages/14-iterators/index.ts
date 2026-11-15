import type { Page, Verified } from '../../core/page.ts';
import en from './en.ts';
import rustEn from './snippet.en.rs?raw';
import tsEn from './snippet.en.ts?raw';
import rust from './snippet.rs?raw';
import ts from './snippet.ts?raw';
import { breakIt, trace } from './trace.ts';
import verifiedJson from './verified.json';

// verified.json 由 scripts/verify-rust.mjs 產生；形狀跑掉的話這一行會在型別檢查時失敗。
const verified: Verified = verifiedJson;

const page: Page = {
  slug: 'iterators',
  kicker: '迭代器與閉包 · Rust Book 第 13 章',
  title: 'map、filter 到 collect 才開始算',
  lead: [
    'JS 陣列的 map 和 filter 是當場做完的：每呼叫一次就走完整個陣列，交出一個新陣列，下一步再從那個新陣列開始。',
    'Rust 的 map 和 filter 只是把管線接起來，一個值都還沒算。等 collect 或 sum 來要結果，值才一個一個流過整條管線，中間不產生陣列。',
  ],
  book: {
    quote: [
      'You can chain multiple calls to iterator adapters to perform complex actions in a readable way.',
      'But because all iterators are lazy, you have to call one of the consuming adapter methods to get results from calls to iterator adapters.',
    ],
    cite: 'The Rust Programming Language §13.2 Processing a Series of Items with Iterators',
    url: 'https://doc.rust-lang.org/book/ch13-02-iterators.html#methods-that-produce-other-iterators',
    urlZh: 'https://rust-lang.tw/book-tw/ch13-02-iterators.html',
  },
  rust,
  ts,
  rustEn,
  tsEn,
  en,
  trace,
  breakIt,
  verified,
};

export default page;
