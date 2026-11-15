import type { Page, Verified } from '../../core/page.ts';
import rust from './snippet.rs?raw';
import ts from './snippet.ts?raw';
import { breakIt, trace } from './trace.ts';
import verifiedJson from './verified.json';

// verified.json 由 scripts/verify-rust.mjs 產生；形狀跑掉的話這一行會在型別檢查時失敗。
const verified: Verified = verifiedJson;

const page: Page = {
  slug: 'mut-borrow',
  kicker: '借用 · Rust Book 第 4 章',
  title: '&mut：一次只能有一道',
  lead: [
    '在 JS 裡，任何一條線都能改值，其他連著同一顆值的線事先不會知道，下次讀到的就是改過的樣子。',
    '在 Rust 裡，要改借來的值得用 &mut。它是唯一一道實心光束：亮著的時候不能有其他借用，所以不會有人讀到一半值被換掉。',
  ],
  book: {
    quote: [
      'Mutable references have one big restriction: If you have a mutable reference to a value, you can have no other references to that value.',
      'We also cannot have a mutable reference while we have an immutable one to the same value.',
      'Users of an immutable reference don’t expect the value to suddenly change out from under them!',
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
