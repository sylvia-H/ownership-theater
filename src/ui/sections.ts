// 首頁的分區索引：分區與各區的 slug 是固定資料，標題一律用 slug 去 pages 查。
// 這裡列了但 pages 還沒註冊的 slug，首頁會顯示成「製作中」。

export interface Section {
  id: string;
  name: string;
  /** 對應 Rust Book 的哪一章 */
  sub: string;
  slugs: string[];
}

export const sections: Section[] = [
  {
    id: 'ownership',
    name: '所有權',
    sub: 'Rust Book 第 4 章',
    slugs: ['move', 'copy-vs-move', 'functions', 'scope-drop'],
  },
  {
    id: 'borrowing',
    name: '借用',
    sub: 'Rust Book 第 4 章',
    slugs: ['shared-borrow', 'mut-borrow', 'nll', 'dangling', 'slices'],
  },
  {
    id: 'no-null',
    name: '沒有 null',
    sub: 'Rust Book 第 6 章',
    slugs: ['option', 'match'],
  },
  {
    id: 'errors',
    name: '錯誤處理',
    sub: 'Rust Book 第 9 章',
    slugs: ['result'],
  },
  {
    id: 'lifetimes',
    name: '生命週期',
    sub: 'Rust Book 第 10 章',
    slugs: ['lifetimes'],
  },
  {
    id: 'iterators',
    name: '迭代器',
    sub: 'Rust Book 第 13 章',
    slugs: ['iterators'],
  },
  {
    id: 'smart-pointers',
    name: '智慧指標與收尾',
    sub: 'Rust Book 第 15 章',
    slugs: ['rc', 'refcell', 'rc-refcell'],
  },
];
