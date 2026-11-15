fn main() {
    let a: Option<String> = Some(String::from("hi"));
    let b: Option<String> = None;
    if let Some(text) = a {
        println!("{}", text.to_uppercase());
    }
    println!("{}", b.to_uppercase());
    if let Some(text) = b {
        println!("{}", text.to_uppercase());
    }
}
