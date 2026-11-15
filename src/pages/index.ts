import type { PageEntry } from '../core/page.ts';

// 每頁動態載入，首屏只帶目前這一頁的內容。
export const pages: PageEntry[] = [
  {
    slug: 'move',
    title: 'let b = a; 之後再用 a',
    load: () => import('./01-move/index.ts').then((m) => m.default),
  },
  {
    slug: 'copy-vs-move',
    title: '整數是複製，String 是搬走',
    load: () => import('./02-copy-vs-move/index.ts').then((m) => m.default),
  },
  {
    slug: 'functions',
    title: '傳進函式、從函式回傳',
    load: () => import('./03-functions/index.ts').then((m) => m.default),
  },
  {
    slug: 'scope-drop',
    title: '離開 { } 的那一刻',
    load: () => import('./04-scope-drop/index.ts').then((m) => m.default),
  },
  {
    slug: 'shared-borrow',
    title: '&s：借來看，不拿走',
    load: () => import('./05-shared-borrow/index.ts').then((m) => m.default),
  },
  {
    slug: 'mut-borrow',
    title: '&mut：一次只能有一道',
    load: () => import('./06-mut-borrow/index.ts').then((m) => m.default),
  },
  {
    slug: 'nll',
    title: '借用在最後一次使用後結束',
    load: () => import('./07-nll/index.ts').then((m) => m.default),
  },
  {
    slug: 'dangling',
    title: '回傳區域變數的參考',
    load: () => import('./08-dangling/index.ts').then((m) => m.default),
  },
  {
    slug: 'slices',
    title: 'slice：只借其中一段',
    load: () => import('./09-slices/index.ts').then((m) => m.default),
  },
  {
    slug: 'option',
    title: 'null 與 Option<T>',
    load: () => import('./10-option/index.ts').then((m) => m.default),
  },
  {
    slug: 'match',
    title: 'match 要列出所有情況',
    load: () => import('./11-match/index.ts').then((m) => m.default),
  },
  {
    slug: 'result',
    title: 'throw 與 Result<T, E>',
    load: () => import('./12-result/index.ts').then((m) => m.default),
  },
  {
    slug: 'lifetimes',
    title: "'a：回傳的參考能活多久",
    load: () => import('./13-lifetimes/index.ts').then((m) => m.default),
  },
  {
    slug: 'iterators',
    title: 'map、filter 到 collect 才開始算',
    load: () => import('./14-iterators/index.ts').then((m) => m.default),
  },
  {
    slug: 'rc',
    title: 'Rc<T>：一個值，多個擁有者',
    load: () => import('./15-rc/index.ts').then((m) => m.default),
  },
  {
    slug: 'refcell',
    title: 'RefCell<T>：借用規則改到執行期檢查',
    load: () => import('./16-refcell/index.ts').then((m) => m.default),
  },
  {
    slug: 'rc-refcell',
    title: 'Rc<RefCell<T>>：JS 的預設，在 Rust 要明講',
    load: () => import('./17-rc-refcell/index.ts').then((m) => m.default),
  },
];
