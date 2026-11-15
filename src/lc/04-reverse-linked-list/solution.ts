// LeetCode #206 Reverse Linked List。
// 標記之間是顯示給讀者的解法（含 LeetCode 給的節點定義），其餘是測試外殼。
// 解法照 LeetCode 上的寫法，所以不跟著專案的 tsconfig 檢查（在 tsconfig.json 的 exclude 裡）。

// --- solution ---
class ListNode {
  val: number;
  next: ListNode | null;
  constructor(val?: number, next?: ListNode | null) {
    this.val = val === undefined ? 0 : val;
    this.next = next === undefined ? null : next;
  }
}

function reverseList(head: ListNode | null): ListNode | null {
  let prev: ListNode | null = null;
  let curr = head;
  while (curr !== null) {
    const next = curr.next;
    curr.next = prev;
    prev = curr;
    curr = next;
  }
  return prev;
}
// --- end ---

function fromArray(vals: number[]): ListNode | null {
  let head: ListNode | null = null;
  for (let i = vals.length - 1; i >= 0; i--) head = new ListNode(vals[i], head);
  return head;
}

function toArray(head: ListNode | null): number[] {
  const vals: number[] = [];
  for (let curr = head; curr !== null; curr = curr.next) vals.push(curr.val);
  return vals;
}

const show = (xs: number[]): string => `[${xs.join(', ')}]`;

console.log(show(toArray(reverseList(fromArray([1, 2, 3, 4, 5])))));
console.log(show(toArray(reverseList(fromArray([1, 2])))));
console.log(show(toArray(reverseList(fromArray([])))));

export {};
