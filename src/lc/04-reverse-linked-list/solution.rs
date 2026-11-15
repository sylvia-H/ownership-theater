// LeetCode #206 Reverse Linked List。
// 標記之間是顯示給讀者的解法（含 LeetCode 給的節點定義），其餘是測試外殼。

struct Solution;

// --- solution ---
pub struct ListNode {
    pub val: i32,
    pub next: Option<Box<ListNode>>,
}

impl Solution {
    pub fn reverse_list(head: Option<Box<ListNode>>) -> Option<Box<ListNode>> {
        let mut prev = None;
        let mut curr = head;
        while let Some(mut node) = curr {
            curr = node.next.take();
            node.next = prev;
            prev = Some(node);
        }
        prev
    }
}
// --- end ---

fn from_vec(vals: &[i32]) -> Option<Box<ListNode>> {
    let mut head = None;
    for &val in vals.iter().rev() {
        head = Some(Box::new(ListNode { val, next: head }));
    }
    head
}

fn to_vec(head: &Option<Box<ListNode>>) -> Vec<i32> {
    let mut vals = Vec::new();
    let mut curr = head;
    while let Some(node) = curr {
        vals.push(node.val);
        curr = &node.next;
    }
    vals
}

fn main() {
    println!("{:?}", to_vec(&Solution::reverse_list(from_vec(&[1, 2, 3, 4, 5]))));
    println!("{:?}", to_vec(&Solution::reverse_list(from_vec(&[1, 2]))));
    println!("{:?}", to_vec(&Solution::reverse_list(from_vec(&[]))));
}
