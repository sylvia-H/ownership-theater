use std::rc::Rc;

fn main() {
    let a = Rc::new(String::from("hello"));
    {
        let b = Rc::clone(&a);
        println!("{} {}", b, Rc::strong_count(&a)); // hello 2
    }
    println!("{} {}", a, Rc::strong_count(&a)); // hello 1
}
