// LeetCode #344 Reverse String。標記之間是顯示給讀者的解法，其餘是測試外殼。
// 解法照 LeetCode 上的寫法，所以不跟著專案的 tsconfig 檢查（在 tsconfig.json 的 exclude 裡）。

// --- solution ---
function reverseString(s: string[]): void {
  let left = 0;
  let right = s.length - 1;
  while (left < right) {
    [s[left], s[right]] = [s[right], s[left]];
    left++;
    right--;
  }
}
// --- end ---

function run(text: string): void {
  const s = text.split('');
  reverseString(s);
  console.log(s.join(''));
}

run('hello');
run('Hannah');
run('a');

export {};
