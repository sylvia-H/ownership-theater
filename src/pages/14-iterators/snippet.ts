function main() {
  const v = [1, 2, 3];
  const doubled = v.map((x) => x * 2); // 新陣列 [2, 4, 6]
  const big = doubled.filter((x) => x > 2); // 又一個新陣列 [4, 6]
  console.log("兩個新陣列都已經算好了");
  const out = big; // 不需要 collect，big 本來就是陣列
  console.log(out);
}
