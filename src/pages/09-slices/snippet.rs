fn main() {
    let s = String::from("hello world");
    let hello = &s[0..5];
    println!("{}", hello);
    let nums = [1, 2, 3, 4, 5];
    let mid = &nums[1..3];
    println!("{:?}", mid);
}
