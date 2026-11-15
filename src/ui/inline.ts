// 行內程式碼：文字裡成對的反引號之間是程式碼，畫面上包成 <code>。
// 不是 markdown，只處理成對的反引號；落單的反引號照原樣顯示。

export interface Segment {
  text: string;
  code: boolean;
}

/** 把文字切成一般文字與程式碼交錯的段落；空的段落不輸出 */
export function splitInlineCode(text: string): Segment[] {
  const out: Segment[] = [];
  let rest = text;
  for (;;) {
    const open = rest.indexOf('`');
    const close = open < 0 ? -1 : rest.indexOf('`', open + 1);
    if (close < 0) break;
    if (open > 0) out.push({ text: rest.slice(0, open), code: false });
    // 連著兩個反引號（空的程式碼）沒有東西可畫，直接略過
    if (close > open + 1) out.push({ text: rest.slice(open + 1, close), code: true });
    rest = rest.slice(close + 1);
  }
  if (rest) out.push({ text: rest, code: false });
  return out;
}

/** 去掉標記用的反引號：給 aria-label、document.title 這些只能放純文字的地方 */
export function stripInlineCode(text: string): string {
  return splitInlineCode(text)
    .map((s) => s.text)
    .join('');
}
