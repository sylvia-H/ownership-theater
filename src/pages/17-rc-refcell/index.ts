import type { Page, Verified } from '../../core/page.ts';
import en from './en.ts';
import rust from './snippet.rs?raw';
import ts from './snippet.ts?raw';
import { breakIt, trace } from './trace.ts';
import verifiedJson from './verified.json';

// verified.json 由 scripts/verify-rust.mjs 產生；形狀跑掉的話這一行會在型別檢查時失敗。
const verified: Verified = verifiedJson;

const page: Page = {
  slug: 'rc-refcell',
  kicker: '收尾 · Rust Book 第 15 章',
  title: 'Rc<RefCell<T>>：JS 的預設，在 Rust 要明講',
  lead: [
    '兩個名字指向同一個物件，誰都能改，另一邊馬上看得到。JS 每天都這樣寫，因為這就是它的預設。',
    '同一件事 Rust 也做得到，只是要明講：共享寫 Rc，可改寫 RefCell。兩邊的差別不在有沒有這個能力，而在預設給不給。',
  ],
  book: {
    quote: [
      'Recall that Rc<T> lets you have multiple owners of some data, but it only gives immutable access to that data.',
      'If you have an Rc<T> that holds a RefCell<T>, you can get a value that can have multiple owners and that you can mutate!',
    ],
    cite: 'The Rust Programming Language §15.5 RefCell<T> and the Interior Mutability Pattern',
    url: 'https://doc.rust-lang.org/book/ch15-05-interior-mutability.html#allowing-multiple-owners-of-mutable-data',
    urlZh: 'https://rust-lang.tw/book-tw/ch15-05-interior-mutability.html',
  },
  rust,
  ts,
  en,
  trace,
  breakIt,
  verified,
};

export default page;
