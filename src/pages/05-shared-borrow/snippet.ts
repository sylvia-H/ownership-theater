function main() {
  const s = { text: "hello" };
  const r1 = s;
  const r2 = s;
  console.log(r1.text, r2.text);
  console.log(s.text);
}
