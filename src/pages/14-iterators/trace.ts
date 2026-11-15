// 第 14 頁的執行軌跡。純資料：不 import 任何 ?raw 或 JSON，測試才能用 node 直接載入。
// 行號對應 snippet.rs 與 snippet.ts（1 起算）。
//
// JS：map、filter 各自當場算完，多出兩顆新陣列（光球）。
// Rust：第 2、3 步只是把管線一段一段接上去（doubled、big 握的是管線，不是值），沒有任何新值。
// 第 6 行的 collect 拆成五拍：接上出口（out 握住一個空的 Vec）、三個元素一個一個流過整條管線、管線消失。
// 元素流過的順序（1 被擋下、2 與 3 通過）是依迭代器的語意寫的，片段的 stdout 只能佐證「先印訊息、後有結果」。
// 這幾拍 JS 沒有事件：值在第 3、4 行就算完了。

import type { Trace } from '../../core/trace.ts';

const IDLE = '這邊沒事：值早就算完了。';

export const trace: Trace = {
  steps: [
    {
      rustLine: 2,
      tsLine: 2,
      caption: {
        js: 'v 連到陣列 [1, 2, 3]。',
        rust: 'v 握住 [1, 2, 3]。',
      },
      js: [
        { type: 'alloc', value: 'o1', label: '[1, 2, 3]' },
        { type: 'bind', binding: 'v', value: 'o1' },
      ],
      rust: [
        { type: 'alloc', value: 'v1', label: '[1, 2, 3]' },
        { type: 'bind', binding: 'v', value: 'v1' },
      ],
    },
    {
      rustLine: 3,
      tsLine: 3,
      caption: {
        js: 'map 當場算完，多一顆新陣列。',
        rust: '只接上一段管線，什麼都還沒算。',
      },
      js: [
        { type: 'alloc', value: 'o2', label: '[2, 4, 6]' },
        { type: 'bind', binding: 'doubled', value: 'o2' },
      ],
      rust: [{ type: 'pipe', id: 'p', binding: 'doubled', of: 'v', stage: 'map ×2' }],
    },
    {
      rustLine: 4,
      tsLine: 4,
      caption: {
        js: 'filter 又算出一顆新陣列。',
        rust: '再接一段，還是沒有值流過。',
      },
      js: [
        { type: 'alloc', value: 'o3', label: '[4, 6]' },
        { type: 'bind', binding: 'big', value: 'o3' },
      ],
      rust: [{ type: 'pipe-extend', pipe: 'p', to: 'big', stage: 'filter >2' }],
    },
    {
      rustLine: 5,
      tsLine: 5,
      caption: {
        js: '兩個中間陣列都已經算好。',
        rust: '到這裡還沒算出任何值。',
      },
      js: [],
      rust: [],
    },
    {
      rustLine: 6,
      tsLine: 6,
      caption: {
        js: 'out 只是多連一條線。',
        rust: 'collect 來要結果，管線接上出口。',
      },
      js: [{ type: 'bind', binding: 'out', value: 'o3' }],
      rust: [{ type: 'collect', pipe: 'p', to: 'out', value: 'v2', label: '[]' }],
    },
    {
      rustLine: 6,
      tsLine: null,
      caption: {
        js: IDLE,
        rust: '1 變成 2，被 filter 擋下。',
      },
      js: [],
      rust: [{ type: 'pull', pipe: 'p', path: ['1', '2'] }],
    },
    {
      rustLine: 6,
      tsLine: null,
      caption: {
        js: IDLE,
        rust: '2 變成 4，通過，收進 out。',
      },
      js: [],
      rust: [{ type: 'pull', pipe: 'p', path: ['2', '4', '4'], label: '[4]' }],
    },
    {
      rustLine: 6,
      tsLine: null,
      caption: {
        js: IDLE,
        rust: '3 變成 6，也通過。一次只流一個。',
      },
      js: [],
      rust: [{ type: 'pull', pipe: 'p', path: ['3', '6', '6'], label: '[4, 6]' }],
    },
    {
      rustLine: 6,
      tsLine: null,
      caption: {
        js: IDLE,
        rust: '流完了，管線消失，v 不再被借。',
      },
      js: [],
      rust: [{ type: 'end-pipe', pipe: 'p' }],
    },
    {
      rustLine: 7,
      tsLine: 7,
      caption: {
        js: '印出 [4, 6]。',
        rust: '印出 [4, 6]。',
      },
      js: [{ type: 'use', binding: 'out' }],
      rust: [{ type: 'use', binding: 'out' }],
    },
    {
      rustLine: 8,
      tsLine: 8,
      caption: {
        js: '三顆球都留著等 GC。',
        rust: 'out 和 v 離開 scope，當場碎掉。',
      },
      js: [
        { type: 'unbind', binding: 'out' },
        { type: 'unbind', binding: 'big' },
        { type: 'unbind', binding: 'doubled' },
        { type: 'unbind', binding: 'v' },
      ],
      rust: [
        { type: 'drop', binding: 'out' },
        { type: 'drop', binding: 'big' },
        { type: 'drop', binding: 'doubled' },
        { type: 'drop', binding: 'v' },
      ],
    },
  ],
};

export const breakIt = null;
