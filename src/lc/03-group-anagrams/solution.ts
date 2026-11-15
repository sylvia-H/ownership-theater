// LeetCode #49 Group Anagrams。標記之間是顯示給讀者的解法，其餘是測試外殼。
// 解法照 LeetCode 上的寫法，所以不跟著專案的 tsconfig 檢查（在 tsconfig.json 的 exclude 裡）。

// --- solution ---
function groupAnagrams(strs: string[]): string[][] {
  const groups = new Map<string, string[]>();
  for (const s of strs) {
    const chars = s.split('');
    chars.sort();
    const key = chars.join('');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }
  return [...groups.values()];
}
// --- end ---

const list = (items: string[]): string => `[${items.join(', ')}]`;

// 與 Rust 版相同：印之前先把每一組、再把各組排序。
function run(words: string[]): void {
  const groups = groupAnagrams(words);
  for (const group of groups) group.sort();
  groups.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  console.log(list(groups.map((g) => list(g.map((s) => JSON.stringify(s))))));
}

run(['eat', 'tea', 'tan', 'ate', 'nat', 'bat']);
run(['']);
run(['a']);

export {};
