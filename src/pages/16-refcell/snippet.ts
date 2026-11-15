function main() {
  const cell = [1, 2];
  const w = cell;
  w.push(3);
  // 沒有「還回去」這一步
  const w2 = cell;
  w2.push(4);
  console.log(w2); // [1, 2, 3, 4]
}
