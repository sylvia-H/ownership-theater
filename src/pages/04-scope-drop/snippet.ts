function main() {
  const a = { text: "outer" };
  {
    const b = { text: "inner" };
    console.log(a.text, b.text);
  }
  console.log(a.text);
}
