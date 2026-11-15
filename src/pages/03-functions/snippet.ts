function show(s: string[]) {
  console.log(s[0]);
}
const pass = (s: string[]) => s;
function main() {
  const a = ["hello"];
  const b = pass(a);
  show(b);
}
