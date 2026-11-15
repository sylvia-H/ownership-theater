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
  slug: 'rc',
  kicker: '智慧指標 · Rust Book 第 15 章',
  title: 'Rc<T>：一個值，多個擁有者',
  lead: [
    'JS 裡多個名字連到同一顆值是預設，什麼都不用寫。值什麼時候被收走由 GC 決定，程式裡看不到也數不到。',
    'Rust 預設一個值只有一個擁有者。真的需要共享時，用 Rc 把值包起來：多一個擁有者計數加一，少一個減一，歸零的那一刻值才被釋放。',
  ],
  book: {
    quote: [
      'You have to enable multiple ownership explicitly by using the Rust type Rc<T>, which is an abbreviation for reference counting.',
      'The Rc<T> type keeps track of the number of references to a value to determine whether or not the value is still in use.',
      'If there are zero references to a value, the value can be cleaned up without any references becoming invalid.',
    ],
    cite: 'The Rust Programming Language §15.4 Rc<T>, the Reference-Counted Smart Pointer',
    url: 'https://doc.rust-lang.org/book/ch15-04-rc.html#rct-the-reference-counted-smart-pointer',
    urlZh: 'https://rust-lang.tw/book-tw/ch15-04-rc.html',
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
