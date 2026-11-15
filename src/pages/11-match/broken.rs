use std::cmp::Ordering;
fn main() {
    let order = 5.cmp(&5);
    let text = match order {
        Ordering::Less => "smaller",
        Ordering::Greater => "bigger",
    };
    println!("{}", text);
}
