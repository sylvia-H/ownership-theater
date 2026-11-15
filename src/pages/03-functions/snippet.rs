fn show(s: String) {
    println!("{}", s);
}
fn pass(s: String) -> String { s }
fn main() {
    let a = String::from("hello");
    let b = pass(a);
    show(b);
}
