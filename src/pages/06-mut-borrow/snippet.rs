fn main() {
    let mut s = String::from("hello");
    let r = &s;
    println!("{}", r);
    let m = &mut s;
    m.push_str(" world");
    println!("{}", m);
}
