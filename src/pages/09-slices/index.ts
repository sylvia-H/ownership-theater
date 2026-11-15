import type { Page, Verified } from '../../core/page.ts';
import rust from './snippet.rs?raw';
import ts from './snippet.ts?raw';
import { breakIt, trace } from './trace.ts';
import verifiedJson from './verified.json';

// verified.json 由 scripts/verify-rust.mjs 產生；形狀跑掉的話這一行會在型別檢查時失敗。
const verified: Verified = verifiedJson;

const page: Page = {
  slug: 'slices',
  kicker: '借用 · Rust Book 第 4 章',
  title: 'slice：只借其中一段',
  lead: [
    '在 JS 裡，slice() 會做出一顆新的值，內容是原本的一部分，之後兩顆各過各的。',
    '在 Rust 裡，slice 是一道只照到其中一段的光束，沒有複製，也不擁有值。&str 照字串的一段，&[T] 照陣列的一段。',
  ],
  book: {
    quote: [
      'Slices let you reference a contiguous sequence of elements in a collection.',
      'A slice is a kind of reference, so it does not have ownership.',
      'Rather than a reference to the entire String, hello is a reference to a portion of the String, specified in the extra [0..5] bit.',
    ],
    cite: 'The Rust Programming Language §4.3 The Slice Type',
    url: 'https://doc.rust-lang.org/book/ch04-03-slices.html#the-slice-type',
    urlZh: 'https://rust-lang.tw/book-tw/ch04-03-slices.html',
  },
  rust,
  ts,
  trace,
  breakIt,
  verified,
};

export default page;
