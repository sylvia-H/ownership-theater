type Order = -1 | 0 | 1;
function main() {
  const order = Math.sign(5 - 5) as Order;
  let text;
  switch (order) {
    case -1: text = "smaller"; break;
    case 1: text = "bigger"; break;
    // 0 is missing: no error, text stays undefined
  }
  console.log(text); // prints undefined
}
