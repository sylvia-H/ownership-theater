function main() {
  const a = { text: "hello" };
  {
    const b = a;
    console.log(b.text); // two lines to one value, and no count to print
  }
  console.log(a.text);
}
