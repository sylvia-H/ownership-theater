// 首頁開場的軌跡：全站最短的一齣戲，兩步。純資料，寫法與各頁的 trace.ts 相同。
// 沒有對應的程式碼面板，所以行號都是 null。
// 舞台上的標籤與兩句字幕依介面語言不同，由呼叫端給（home.zh.ts／home.en.ts 的 intro）。

import type { Trace } from '../core/trace.ts';

export interface IntroText {
  /** 兩個 alloc 事件的標籤：舞台上值旁邊的字 */
  valueLabel: string;
  /** 與兩步一一對應 */
  captions: { js: string; rust: string }[];
}

/** 開場有幾步 */
export const INTRO_STEPS = 2;

export function buildIntroTrace(text: IntroText): Trace {
  const caption = (i: number) => text.captions[i] ?? { js: '', rust: '' };
  return {
    steps: [
      {
        rustLine: null,
        tsLine: null,
        caption: caption(0),
        js: [
          { type: 'alloc', value: 'o1', label: text.valueLabel },
          { type: 'bind', binding: 'a', value: 'o1' },
        ],
        rust: [
          { type: 'alloc', value: 'v1', label: text.valueLabel },
          { type: 'bind', binding: 'a', value: 'v1' },
        ],
      },
      {
        rustLine: null,
        tsLine: null,
        caption: caption(1),
        js: [{ type: 'bind', binding: 'b', value: 'o1' }],
        rust: [{ type: 'move', from: 'a', to: 'b' }],
      },
    ],
  };
}

/** 開場從 t=0 播到 t=INTRO_END 花多久 */
export const INTRO_MS = 2400;
/** 進首頁後先等這麼久才開演（讓場景先畫出第一幀） */
export const INTRO_DELAY_MS = 250;
/** 播到這個比例時標題淡入 */
export const INTRO_TITLE_AT = 0.6;
