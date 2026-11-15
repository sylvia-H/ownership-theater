fn make<'a>() -> &'a String {
    let s = String::from("hello");
    &s
}

fn main() {
    let r = make();
    println!("{}", r);
}
