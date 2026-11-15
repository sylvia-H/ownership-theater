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
  slug: 'option',
  kicker: '沒有 null · Rust Book 第 6 章',
  title: 'null 與 Option<T>',
  lead: [
    'JS 用 null 與 undefined 表示「沒有值」，但變數看起來和有值時一樣。忘了檢查就去用，要等執行到那一行才丟 TypeError。',
    'Rust 沒有 null。可能沒有值的東西要裝進 Option 這個盒子：Some 裡面有值，None 是空盒。盒子不是值本身，不打開就拿不到裡面的東西。',
  ],
  book: {
    quote: [
      'As such, Rust does not have nulls, but it does have an enum that can encode the concept of a value being present or absent.',
      'In other words, you have to convert an Option<T> to a T before you can perform T operations with it.',
    ],
    cite: 'The Rust Programming Language §6.1 The Option Enum',
    url: 'https://doc.rust-lang.org/book/ch06-01-defining-an-enum.html#the-option-enum',
    urlZh: 'https://rust-lang.tw/book-tw/ch06-01-defining-an-enum.html',
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
