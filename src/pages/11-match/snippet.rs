use std::cmp::Ordering;
fn main() {
    let order = 5.cmp(&5);
    let text = match order {
        Ordering::Less => "smaller",
        Ordering::Equal => "same",
        Ordering::Greater => "bigger",
    };
    println!("{}", text);
}
