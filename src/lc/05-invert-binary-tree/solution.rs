// LeetCode #226 Invert Binary Tree。
// 標記之間是顯示給讀者的解法（含 LeetCode 給的節點定義），其餘是測試外殼。

struct Solution;

// --- solution ---
use std::cell::RefCell;
use std::rc::Rc;
pub struct TreeNode {
    pub val: i32,
    pub left: Option<Rc<RefCell<TreeNode>>>,
    pub right: Option<Rc<RefCell<TreeNode>>>,
}

impl Solution {
    pub fn invert_tree(root: Option<Rc<RefCell<TreeNode>>>) -> Option<Rc<RefCell<TreeNode>>> {
        if let Some(node) = &root {
            let mut n = node.borrow_mut();
            let left = Self::invert_tree(n.left.take());
            let right = Self::invert_tree(n.right.take());
            n.left = right;
            n.right = left;
        }
        root
    }
}
// --- end ---

use std::collections::VecDeque;

// 測資都是完全二元樹，用階層順序的陣列表示：i 的左右子節點是 2i+1、2i+2。
fn build(vals: &[i32], i: usize) -> Option<Rc<RefCell<TreeNode>>> {
    if i >= vals.len() {
        return None;
    }
    Some(Rc::new(RefCell::new(TreeNode {
        val: vals[i],
        left: build(vals, 2 * i + 1),
        right: build(vals, 2 * i + 2),
    })))
}

fn level_order(root: &Option<Rc<RefCell<TreeNode>>>) -> Vec<i32> {
    let mut vals = Vec::new();
    let mut queue = VecDeque::new();
    if let Some(node) = root {
        queue.push_back(Rc::clone(node));
    }
    while let Some(node) = queue.pop_front() {
        let n = node.borrow();
        vals.push(n.val);
        for child in [&n.left, &n.right].into_iter().flatten() {
            queue.push_back(Rc::clone(child));
        }
    }
    vals
}

fn main() {
    println!("{:?}", level_order(&Solution::invert_tree(build(&[4, 2, 7, 1, 3, 6, 9], 0))));
    println!("{:?}", level_order(&Solution::invert_tree(build(&[2, 1, 3], 0))));
    println!("{:?}", level_order(&Solution::invert_tree(build(&[], 0))));
}
