type Order = -1 | 0 | 1;
function main() {
  const order = Math.sign(5 - 5) as Order;
  let text;
  switch (order) {
    case -1: text = "smaller"; break;
    case 1: text = "bigger"; break;
    // 漏了 0：不會報錯，text 維持 undefined
  }
  console.log(text); // 印出 undefined
}
