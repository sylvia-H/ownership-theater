fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() { x } else { y }
}
fn main() {
    let a = String::from("long string");
    let result;
    {
        let b = String::from("xyz");
        result = longest(&a, &b);
        println!("{}", result);
    }
}
