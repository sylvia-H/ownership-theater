function main() {
  const words = ["hi"];
  const a = words[0];
  const b = words[1]; // 沒有這一格，拿到 undefined；型別卻寫 string
  console.log(a.toUpperCase());
  console.log(b.toUpperCase()); // 執行到這裡才丟 TypeError
}
