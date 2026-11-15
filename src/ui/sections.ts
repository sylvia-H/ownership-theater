// 首頁的分區索引：分區與各區的 slug 是固定資料，標題一律用 slug 去 pages 查。
// 這裡列了但 pages 還沒註冊的 slug，首頁會顯示成「製作中」。
// 分區的名稱與副標（對應 Rust Book 的哪一章）是顯示文字，中英各一份，放在 home.zh.ts／home.en.ts 的 sections，
// 以 id 為鍵；id 的型別取自那裡，所以新增分區卻沒寫名稱時型別檢查不會過。

import type { HomeText } from './home.en.ts';

export type SectionId = Exclude<keyof HomeText['sections'], 'lc'>;

export interface Section {
  id: SectionId;
  slugs: string[];
}

export const sections: Section[] = [
  { id: 'ownership', slugs: ['move', 'copy-vs-move', 'functions', 'scope-drop'] },
  { id: 'borrowing', slugs: ['shared-borrow', 'mut-borrow', 'nll', 'dangling', 'slices'] },
  { id: 'no-null', slugs: ['option', 'match'] },
  { id: 'errors', slugs: ['result'] },
  { id: 'lifetimes', slugs: ['lifetimes'] },
  { id: 'iterators', slugs: ['iterators'] },
  { id: 'smart-pointers', slugs: ['rc', 'refcell', 'rc-refcell'] },
];

/** 排在最後的頁籤：LeetCode 對照。它的卡片來自 src/lc/index.ts 的 problems，不算進 17 齣的統計。 */
export const lcSection = { id: 'lc' } as const;
