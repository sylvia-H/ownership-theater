// LeetCode #49 Group Anagrams。標記之間是顯示給讀者的解法，其餘是測試外殼。

struct Solution;

// --- solution ---
use std::collections::HashMap;
impl Solution {
    pub fn group_anagrams(strs: Vec<String>) -> Vec<Vec<String>> {
        let mut groups: HashMap<String, Vec<String>> = HashMap::new();
        for s in strs {
            let mut chars: Vec<char> = s.chars().collect();
            chars.sort();
            let key: String = chars.iter().collect();
            groups.entry(key).or_default().push(s);
        }
        groups.into_values().collect()
    }
}
// --- end ---

// HashMap 的走訪順序不固定，所以印之前先把每一組、再把各組排序。
fn run(words: &[&str]) {
    let strs: Vec<String> = words.iter().map(|w| w.to_string()).collect();
    let mut groups = Solution::group_anagrams(strs);
    for group in groups.iter_mut() {
        group.sort();
    }
    groups.sort();
    println!("{:?}", groups);
}

fn main() {
    run(&["eat", "tea", "tan", "ate", "nat", "bat"]);
    run(&[""]);
    run(&["a"]);
}
