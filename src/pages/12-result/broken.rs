fn main() {
    let result = "abc".parse::<i32>();
    println!("{}", result + 1);
    match result {
        Ok(n) => println!("{}", n + 1),
        Err(e) => println!("error: {}", e),
    }
}
