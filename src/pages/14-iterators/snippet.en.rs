fn main() {
    let v = vec![1, 2, 3];
    let doubled = v.iter().map(|x| x * 2);
    let big = doubled.filter(|x| *x > 2);
    println!("no value has been computed yet");
    let out: Vec<i32> = big.collect();
    println!("{:?}", out);
}
