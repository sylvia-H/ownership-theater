use std::cell::RefCell;
use std::rc::Rc;

fn main() {
    let a = Rc::new(RefCell::new(vec![1, 2]));
    let b = Rc::clone(&a);
    b.borrow_mut().push(3);
    println!("{:?}", a.borrow()); // [1, 2, 3]
    println!("{}", Rc::strong_count(&a)); // 2
}
