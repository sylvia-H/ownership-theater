// LeetCode #226 Invert Binary Tree。
// 標記之間是顯示給讀者的解法（含 LeetCode 給的節點定義），其餘是測試外殼。
// 解法照 LeetCode 上的寫法，所以不跟著專案的 tsconfig 檢查（在 tsconfig.json 的 exclude 裡）。

// --- solution ---
class TreeNode {
  val: number;
  left: TreeNode | null;
  right: TreeNode | null;
  constructor(val?: number, left?: TreeNode | null, right?: TreeNode | null) {
    this.val = val === undefined ? 0 : val;
    this.left = left === undefined ? null : left;
    this.right = right === undefined ? null : right;
  }
}

function invertTree(root: TreeNode | null): TreeNode | null {
  if (root !== null) {
    const left = invertTree(root.left);
    const right = invertTree(root.right);
    root.left = right;
    root.right = left;
  }
  return root;
}
// --- end ---

// 測資都是完全二元樹，用階層順序的陣列表示：i 的左右子節點是 2i+1、2i+2。
function build(vals: number[], i: number): TreeNode | null {
  if (i >= vals.length) return null;
  return new TreeNode(vals[i], build(vals, 2 * i + 1), build(vals, 2 * i + 2));
}

function levelOrder(root: TreeNode | null): number[] {
  const vals: number[] = [];
  const queue: TreeNode[] = root === null ? [] : [root];
  while (queue.length > 0) {
    const node = queue.shift()!;
    vals.push(node.val);
    for (const child of [node.left, node.right]) {
      if (child !== null) queue.push(child);
    }
  }
  return vals;
}

const show = (xs: number[]): string => `[${xs.join(', ')}]`;

console.log(show(levelOrder(invertTree(build([4, 2, 7, 1, 3, 6, 9], 0)))));
console.log(show(levelOrder(invertTree(build([2, 1, 3], 0)))));
console.log(show(levelOrder(invertTree(build([], 0)))));

export {};
