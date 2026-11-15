function main() {
  const s = { text: "hello" };
  const r = s;
  console.log(r.text);
  const m = s;
  m.text += " world";
  console.log(m.text);
  console.log(r.text); // r 看到的值也變了
}
