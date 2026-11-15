function main() {
  const a = { text: "hello" };
  {
    const b = a;
    console.log(b.text); // 兩條線連同一顆值，沒有計數可以印
  }
  console.log(a.text);
}
