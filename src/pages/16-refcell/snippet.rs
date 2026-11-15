use std::cell::RefCell;

fn main() {
    let cell = RefCell::new(vec![1, 2]);
    let mut w = cell.borrow_mut();
    w.push(3);
    drop(w);
    let mut w2 = cell.borrow_mut();
    w2.push(4);
    println!("{:?}", w2);
}
