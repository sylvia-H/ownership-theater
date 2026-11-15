fn main() {
    let mut s = String::from("hello");
    let r1 = &s;
    let r2 = &s;
    println!("{} {}", r1, r2);
    let m = &mut s;
    m.push_str(" world");
    println!("{}", s);
}
