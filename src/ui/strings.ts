// 介面字串：元件裡會顯示給讀者的文字（含 aria-label、title）都放這裡，中英各一份。
// en 的型別是 typeof zh，少一個鍵或型別不合，型別檢查就不會過。
// 首頁的文字量大，另外放在 home.zh.ts／home.en.ts；各頁與各題的內容在它們自己的資料夾。

import type { Lang } from './lang.ts';

const zh = {
  // 頁首
  language: '語言',
  soundOn: '音效：開',
  soundOff: '音效：關',
  pagerLabel: '頁面',
  prevPage: '上一頁',
  nextPage: '下一頁',
  lcPagerLabel: 'LeetCode 對照的題目',
  prevProblem: '上一題',
  nextProblem: '下一題',
  /** 頁碼：第幾頁／共幾頁 */
  pageOf: (index: number, total: number): string => `${index}／${total}`,
  loading: '載入中…',
  loadFailed: '這一頁載入失敗，請重新整理再試一次。',
  /** 分頁標題 */
  pageTitle: (title: string): string => `${title}｜所有權劇場`,
  lcTitle: (title: string): string => `${title}｜LeetCode 對照｜所有權劇場`,

  // 劇場頁
  /** Rust Book 繁中譯本的連結；空字串表示這個語言不顯示 */
  bookZh: '繁中譯本',
  stageLabel: '場景',
  webglFailed: '這個瀏覽器無法啟用 WebGL，場景無法顯示；程式碼與說明仍可閱讀。',
  rustcSays: (version: string): string => `rustc ${version} 說：`,
  rustcPanic: (version: string): string => `執行時 panic（rustc ${version}）：`,
  close: '關閉',
  goToStepFirst: (step: number): string => `先走到第 ${step} 步`,
  codeLabel: (title: string): string => `${title} 程式碼`,
  jsWorld: 'JS 世界',
  rustWorld: 'Rust 世界',
  /** 引用計數標籤的前綴，後面接數字 */
  count: '計數',

  // 時間軸
  timeline: '時間軸',
  timelineIdle: '拖動滑桿，或按 → 開始',
  prevStep: '上一步',
  nextStep: '下一步',
  play: '播放',
  pause: '暫停',
  stepOf: (done: number, total: number): string => `第 ${done} 步，共 ${total} 步`,

  // LeetCode 對照頁
  lcKicker: 'LeetCode 對照',
  lcSource: '在 LeetCode 看題目',
  lcDiffTitle: '逐行對照',
  lcLegendIdle: '灰色的行兩邊一對一對應；亮起來的是 Rust 多出來的。滑到類別上，只看那一類。',
  /** 圖例數字後面給螢幕閱讀器的單位 */
  lcRowsUnit: (_count: number): string => ' 列',
  /** 類別名稱接上它的說明或註記 */
  lcLabelled: (label: string, text: string): string => `${label}：${text}`,
  lcNoteColumn: 'Rust 多出來的',
  lcVerified: (version: string): string => `Rust 這一份連同測試用 rustc ${version} 實際編譯、執行過。`,
  lcRelatedTitle: '這題用到的概念，在劇場裡演過',
  lcNavLabel: '其他題目',
  lcBackToIndex: '回首頁的分區索引',
  lcFirst: '這是第一題',
  lcLast: '這是最後一題',
};

export type Strings = typeof zh;

const en: Strings = {
  language: 'Language',
  soundOn: 'Sound: on',
  soundOff: 'Sound: off',
  pagerLabel: 'Acts',
  prevPage: 'Previous act',
  nextPage: 'Next act',
  lcPagerLabel: 'LeetCode problems',
  prevProblem: 'Previous problem',
  nextProblem: 'Next problem',
  pageOf: (index, total) => `${index} / ${total}`,
  loading: 'Loading…',
  loadFailed: 'This page failed to load. Refresh and try again.',
  pageTitle: (title) => `${title} | Ownership Theater`,
  lcTitle: (title) => `${title} | LeetCode | Ownership Theater`,

  bookZh: '',
  stageLabel: 'Stage',
  webglFailed: 'This browser cannot start WebGL, so the stage cannot be shown. The code and the text are still readable.',
  rustcSays: (version) => `rustc ${version} says:`,
  rustcPanic: (version) => `Panic at run time (rustc ${version}):`,
  close: 'Close',
  goToStepFirst: (step) => `Go to step ${step} first`,
  codeLabel: (title) => `${title} code`,
  jsWorld: 'JS world',
  rustWorld: 'Rust world',
  count: 'count',

  timeline: 'Timeline',
  timelineIdle: 'Drag the slider, or press → to start',
  prevStep: 'Previous step',
  nextStep: 'Next step',
  play: 'Play',
  pause: 'Pause',
  stepOf: (done, total) => `Step ${done} of ${total}`,

  lcKicker: 'LeetCode',
  lcSource: 'View the problem on LeetCode',
  lcDiffTitle: 'Line by line',
  lcLegendIdle: 'Gray lines match one to one. Lit lines are what Rust adds. Hover a category to see only that one.',
  lcRowsUnit: (count) => (count === 1 ? ' row' : ' rows'),
  lcLabelled: (label, text) => `${label}: ${text}`,
  lcNoteColumn: 'What Rust adds',
  lcVerified: (version) => `The Rust version, tests included, was compiled and run with rustc ${version}.`,
  lcRelatedTitle: 'Concepts in this problem that the theater has played',
  lcNavLabel: 'Other problems',
  lcBackToIndex: 'Back to the section index',
  lcFirst: 'This is the first problem',
  lcLast: 'This is the last problem',
};

export const STRINGS: Record<Lang, Strings> = { zh, en };
