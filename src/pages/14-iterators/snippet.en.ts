function main() {
  const v = [1, 2, 3];
  const doubled = v.map((x) => x * 2); // a new array: [2, 4, 6]
  const big = doubled.filter((x) => x > 2); // another new array: [4, 6]
  console.log("both new arrays are already computed");
  const out = big; // no collect needed: big is already an array
  console.log(out);
}
