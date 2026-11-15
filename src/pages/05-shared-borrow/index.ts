import type { Page, Verified } from '../../core/page.ts';
import en from './en.ts';
import rust from './snippet.rs?raw';
import ts from './snippet.ts?raw';
import { breakIt, trace } from './trace.ts';
import verifiedJson from './verified.json';

// verified.json 由 scripts/verify-rust.mjs 產生；形狀跑掉的話這一行會在型別檢查時失敗。
const verified: Verified = verifiedJson;

const page: Page = {
  slug: 'shared-borrow',
  kicker: '借用 · Rust Book 第 4 章',
  title: '&s：借來看，不拿走',
  lead: [
    '在 JS 裡，r1 = s 只是多連一條線到同一顆值，每條線都能讀也都能改，沒有誰是主人。',
    '在 Rust 裡，&s 是向擁有者借來看：值仍握在 s 手上，r1、r2 只是照著它的光束。共享借用可以同時有很多道，但都只能讀。',
  ],
  book: {
    quote: [
      'A reference is like a pointer in that it’s an address we can follow to access the data stored at that address; that data is owned by some other variable.',
      'We call the action of creating a reference borrowing.',
      'However, multiple immutable references are allowed because no one who is just reading the data has the ability to affect anyone else’s reading of the data.',
    ],
    cite: 'The Rust Programming Language §4.2 References and Borrowing',
    url: 'https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html#references-and-borrowing',
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
