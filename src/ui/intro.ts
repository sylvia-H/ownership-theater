// 首頁開場的軌跡：全站最短的一齣戲，兩步。純資料，寫法與各頁的 trace.ts 相同。
// 沒有對應的程式碼面板，所以行號都是 null。

import type { Trace } from '../core/trace.ts';

export const introTrace: Trace = {
  steps: [
    {
      rustLine: null,
      tsLine: null,
      caption: {
        js: '一顆值漂在空中，a 連一條線過去',
        rust: 'a 這隻夾具握住這顆值',
      },
      js: [
        { type: 'alloc', value: 'o1', label: '值' },
        { type: 'bind', binding: 'a', value: 'o1' },
      ],
      rust: [
        { type: 'alloc', value: 'v1', label: '值' },
        { type: 'bind', binding: 'a', value: 'v1' },
      ],
    },
    {
      rustLine: null,
      tsLine: null,
      caption: {
        js: 'b 多連一條線到同一顆值',
        rust: '值整顆搬到 b，a 變成空殼',
      },
      js: [{ type: 'bind', binding: 'b', value: 'o1' }],
      rust: [{ type: 'move', from: 'a', to: 'b' }],
    },
  ],
};

/** 開場從 t=0 播到 t=INTRO_END 花多久 */
export const INTRO_MS = 2400;
/** 進首頁後先等這麼久才開演（讓場景先畫出第一幀） */
export const INTRO_DELAY_MS = 250;
/** 播到這個比例時標題淡入 */
export const INTRO_TITLE_AT = 0.6;
