// 把一頁的中文內容換成英文。純函式：只換顯示給讀者的文字，軌跡事件、程式碼對應的行號、verified 都不動。

import type { Page, PageEn } from './page.ts';

/** 舞台標籤照對照表換掉；表裡沒有的原樣回傳 */
export function localizeLabel(label: string, labels: Record<string, string> | undefined): string {
  return labels && Object.hasOwn(labels, label) ? labels[label]! : label;
}

/**
 * 回傳英文版的 Page：kicker、title、lead、每一步的字幕、「弄壞它」的 hint／plain 換成英文，
 * 有英文版片段（rustEn／tsEn）的話程式碼也換。每一步的事件陣列是同一份（沒有複製），
 * 所以用原本的 trace 建好的時間軸可以繼續用。
 */
export function localizePage(page: Page, en: PageEn): Page {
  if (en.captions.length !== page.trace.steps.length) {
    throw new Error(`${page.slug}：英文字幕有 ${en.captions.length} 句，軌跡有 ${page.trace.steps.length} 步`);
  }
  return {
    ...page,
    kicker: en.kicker,
    title: en.title,
    lead: en.lead,
    rust: page.rustEn ?? page.rust,
    ts: page.tsEn ?? page.ts,
    trace: {
      ...page.trace,
      steps: page.trace.steps.map((step, i) => ({ ...step, caption: en.captions[i]! })),
    },
    breakIt: page.breakIt && en.breakIt ? { ...page.breakIt, hint: en.breakIt.hint, plain: en.breakIt.plain } : page.breakIt,
  };
}
