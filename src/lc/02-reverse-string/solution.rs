// LeetCode #344 Reverse String。標記之間是顯示給讀者的解法，其餘是測試外殼。

struct Solution;

// --- solution ---
impl Solution {
    pub fn reverse_string(s: &mut Vec<char>) {
        let mut left = 0;
        let mut right = s.len() - 1;
        while left < right {
            s.swap(left, right);
            left += 1;
            right -= 1;
        }
    }
}
// --- end ---

fn run(text: &str) {
    let mut s: Vec<char> = text.chars().collect();
    Solution::reverse_string(&mut s);
    println!("{}", s.iter().collect::<String>());
}

fn main() {
    run("hello");
    run("Hannah");
    run("a");
}
