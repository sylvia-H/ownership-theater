fn main() {
    let mut s = String::from("hello");
    let r = &s;
    let m = &mut s;
    println!("{}", r);
    m.push_str(" world");
    println!("{}", m);
}
