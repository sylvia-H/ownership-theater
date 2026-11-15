function parse(text: string): number {
  return JSON.parse(text); // "abc" 不是合法 JSON，這裡 throw SyntaxError
}
function main() {
  const n = parse("abc"); // 沒寫 try/catch，也沒有任何提醒
  console.log(n + 1); // 跑不到這一行
}
