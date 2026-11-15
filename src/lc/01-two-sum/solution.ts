// LeetCode #1 Two Sum。標記之間是顯示給讀者的解法，其餘是測試外殼。
// 解法照 LeetCode 上的寫法，所以不跟著專案的 tsconfig 檢查（在 tsconfig.json 的 exclude 裡）。

// --- solution ---
function twoSum(nums: number[], target: number): number[] {
  const seen = new Map<number, number>();
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (seen.has(need)) {
      return [seen.get(need)!, i];
    }
    seen.set(nums[i], i);
  }
  return [];
}
// --- end ---

const show = (xs: number[]): string => `[${xs.join(', ')}]`;

console.log(show(twoSum([2, 7, 11, 15], 9)));
console.log(show(twoSum([3, 2, 4], 6)));
console.log(show(twoSum([3, 3], 6)));

export {};
