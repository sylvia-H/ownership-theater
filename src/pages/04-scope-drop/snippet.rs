fn main() {
    let a = String::from("outer");
    {
        let b = String::from("inner");
        println!("{} {}", a, b);
    }
    println!("{}", a);
}
