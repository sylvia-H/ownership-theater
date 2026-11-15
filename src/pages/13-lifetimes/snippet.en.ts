function longest(x: { text: string }, y: { text: string }) {
  return x.text.length > y.text.length ? x : y;
}
function main() {
  const a = { text: "long string" };
  let result;
  {
    const b = { text: "xyz" };
    result = longest(a, b);
  }
  console.log(result.text); // the scope of b has ended; this still works
}
