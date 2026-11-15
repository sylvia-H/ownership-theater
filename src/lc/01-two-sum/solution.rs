// LeetCode #1 Two Sum。標記之間是顯示給讀者的解法，其餘是測試外殼。

struct Solution;

// --- solution ---
use std::collections::HashMap;
impl Solution {
    pub fn two_sum(nums: Vec<i32>, target: i32) -> Vec<i32> {
        let mut seen = HashMap::new();
        for i in 0..nums.len() {
            let need = target - nums[i];
            if let Some(&j) = seen.get(&need) {
                return vec![j, i as i32];
            }
            seen.insert(nums[i], i as i32);
        }
        vec![]
    }
}
// --- end ---

fn main() {
    println!("{:?}", Solution::two_sum(vec![2, 7, 11, 15], 9));
    println!("{:?}", Solution::two_sum(vec![3, 2, 4], 6));
    println!("{:?}", Solution::two_sum(vec![3, 3], 6));
}
