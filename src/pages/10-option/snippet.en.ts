function main() {
  const words = ["hi"];
  const a = words[0];
  const b = words[1]; // no such slot: undefined, yet the type says string
  console.log(a.toUpperCase());
  console.log(b.toUpperCase()); // the TypeError is thrown only when this runs
}
