// 從完整的 solution.rs／solution.ts 切出「顯示給讀者的解法」：兩行標記之間的文字。
// 標記之外是測試外殼（Solution 的宣告、輔助函式、跑測資的 main），不顯示。

export const SOLUTION_START = '// --- solution ---';
export const SOLUTION_END = '// --- end ---';

/** 回傳兩個標記之間的文字：不含標記行、去掉頭尾空行、換行統一成 \n。找不到標記就 throw。 */
export function extractSolution(source: string): string {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const start = lines.findIndex((l) => l.trim() === SOLUTION_START);
  if (start < 0) throw new Error(`找不到開頭標記「${SOLUTION_START}」`);
  const end = lines.findIndex((l, i) => i > start && l.trim() === SOLUTION_END);
  if (end < 0) throw new Error(`找不到結尾標記「${SOLUTION_END}」`);
  const body = lines.slice(start + 1, end);
  while (body.length && body[0]!.trim() === '') body.shift();
  while (body.length && body[body.length - 1]!.trim() === '') body.pop();
  return body.join('\n');
}
