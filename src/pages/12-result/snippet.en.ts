function parse(text: string): number {
  return JSON.parse(text); // "abc" is not valid JSON: this throws SyntaxError
}
function main() {
  const n = parse("abc"); // no try/catch, and nothing warns you
  console.log(n + 1); // never runs
}
