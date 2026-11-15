function main() {
  const cell = [1, 2];
  const w = cell;
  w.push(3);
  // there is no step that gives it back
  const w2 = cell;
  w2.push(4);
  console.log(w2); // [1, 2, 3, 4]
}
