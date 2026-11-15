fn main() {
    let v = vec![1, 2, 3];
    let doubled = v.iter().map(|x| x * 2);
    let big = doubled.filter(|x| *x > 2);
    println!("還沒有任何值被算出來");
    let out: Vec<i32> = big.collect();
    println!("{:?}", out);
}
