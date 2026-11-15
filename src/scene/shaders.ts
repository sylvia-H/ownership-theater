// 場景的三支 shader：貼片（所有形狀共用一支，用 kind 分流）、線段、星空。
// 全部加法混合，輸出已乘上透明度的顏色。

export const KIND_ORB = 0;
export const KIND_CRYSTAL = 1;
export const KIND_SHARD = 2;
export const KIND_CLAW = 3;
export const KIND_FIELD = 4;
export const KIND_DOT = 5;
/** Copy 型別的值：小菱形 */
export const KIND_CHIP = 6;
/** GC 掃地機；用 iRot 讓它邊走邊轉 */
export const KIND_SWEEPER = 7;
/** Rust 的參考變數：一盞小燈；p1 = lit（光束亮著），p2 = solid（`&mut`） */
export const KIND_LENS = 8;
/** Rust 的盒子：方框加兩片蓋子；p1 = open（蓋子掀開），p2 = 畫哪一半（0 整個、1 左半、2 右半；雙色盒子用兩片拼） */
export const KIND_BOX = 9;
/** match／switch 的閘門：拱門；p1 = lit（值走進這一道），p2 = ghost（試過但不符合，門上打叉） */
export const KIND_GATE = 10;
/** JS 的空位：空的虛線圈 */
export const KIND_HOLE = 11;
/** 閃電的頭：十字星芒 */
export const KIND_SPARK = 12;
/** RefCell 的殼：包在晶體外面的六角框；p1 = lent（登記著借用，整圈亮起），p2 = solid（登記的是 borrow_mut） */
export const KIND_SHELL = 13;
/** 管線一段的節點：圓環加一道橫槽 */
export const KIND_VALVE = 14;

/** 線段的畫法（iParam.z） */
export const SEG_FLOW = 0; // 會流動、照 grow 長出來：JS 的線
export const SEG_SOLID = 1; // 靜止實線：函式的框
export const SEG_DASH = 2; // 靜止虛線：內層 `{ }` 的框、掃地機的軌跡
// 借用的光束：從 A（參考變數）往 B（值）張開的光錐，兩端的邊都是水平的。iParam.x 是 B 端的寬度，
// iParam.y 是 solid（0 = & 半透明、1 = &mut 實心），iParam.w 是 A 端寬度相對 B 端的比例
export const SEG_BEAM = 3;

export const spriteVert = /* glsl */ `
attribute vec3 iPos;
attribute vec4 iColor;
attribute vec4 iParam; // size, kind, p1, p2
attribute float iRot;
varying vec2 vUv;
varying vec4 vColor;
varying vec4 vParam;
void main() {
  vUv = position.xy * 2.0;
  vColor = iColor;
  vParam = iParam;
  float c = cos(iRot);
  float s = sin(iRot);
  vec2 p = vec2(c * position.x - s * position.y, s * position.x + c * position.y) * iParam.x;
  vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
  mv.xy += p;
  gl_Position = projectionMatrix * mv;
}
`;

export const spriteFrag = /* glsl */ `
#define TAU 6.2831853
varying vec2 vUv;
varying vec4 vColor;
varying vec4 vParam;

float sdHex(vec2 p, float r) {
  const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
  p = abs(p);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}

void main() {
  float kind = vParam.y;
  float p1 = vParam.z;
  float p2 = vParam.w;
  float d = length(vUv);
  float ang = atan(vUv.y, vUv.x);
  vec3 col = vec3(0.0);

  if (kind < 0.5) {
    // 光球：核心、邊緣亮環、光暈；p2 = loose（沒有線連著）
    float core = smoothstep(0.44, 0.38, d);
    float rim = smoothstep(0.05, 0.0, abs(d - 0.41));
    float glow = exp(-d * d * 5.0);
    float spec = smoothstep(0.42, 0.0, length(vUv - vec2(-0.13, 0.15)));
    float dash = mix(1.0, 0.35 + 0.65 * step(0.5, fract(ang / TAU * 14.0)), p2);
    col = vColor.rgb * (core * (0.18 + 0.42 * spec) + rim * 0.95 * dash + glow * 0.5);
  } else if (kind < 1.5) {
    // 晶體：六角形、刻面明暗、邊線
    float h = sdHex(vUv, 0.44);
    float body = smoothstep(0.015, -0.015, h);
    float edge = smoothstep(0.045, 0.0, abs(h));
    float facet = 0.5 + 0.5 * cos(floor((ang + TAU / 12.0) / (TAU / 6.0)) * 2.4 + 1.0);
    float inner = smoothstep(0.03, 0.0, abs(sdHex(vUv, 0.21)));
    float spokes = smoothstep(0.035, 0.0, abs(fract(ang / TAU * 6.0 + 0.5) - 0.5) * d * 6.0) * step(0.21, d);
    float glow = exp(-d * d * 7.0) * 0.3;
    col = vColor.rgb * (body * (0.16 + 0.34 * facet) + body * (inner * 0.55 + spokes * 0.3) + edge + glow);
  } else if (kind < 2.5) {
    // 碎片：不等邊三角形
    float t = max(abs(vUv.x) * 1.7 + vUv.y * 0.9, -vUv.y * 1.3) - 0.42;
    col = vColor.rgb * (smoothstep(0.03, -0.03, t) * 0.45 + smoothstep(0.09, 0.0, abs(t)) * 0.9);
  } else if (kind < 3.5) {
    // 夾具：三段弧；p1 = grip（夾緊），p2 = ghost（被搬空的空殼）
    float r = mix(0.86, 0.64, p1);
    float seg = abs(fract((ang + 1.5708) / TAU * 3.0) - 0.5);
    float cover = mix(0.30, 0.43, p1);
    float arc = smoothstep(cover + 0.02, cover, seg);
    float ring = smoothstep(0.06, 0.02, abs(d - r));
    float prong = smoothstep(0.035, 0.0, abs(seg - cover) / max(d, 0.2) * 0.9)
      * smoothstep(r - 0.17, r - 0.12, d) * smoothstep(r + 0.04, r, d);
    float dash = mix(1.0, step(0.5, fract(ang / TAU * 36.0)), p2);
    float halo = exp(-pow((d - r) * 7.0, 2.0)) * arc * 0.3 * (1.0 - p2);
    col = vColor.rgb * ((ring * arc + prong * 0.8) * dash * mix(1.0, 0.4, p2) + halo);
  } else if (kind < 4.5) {
    // 力場漣漪：p1 = 進度 0..1
    float r = 0.12 + 0.8 * p1;
    float ring = smoothstep(0.09, 0.0, abs(d - r)) + 0.5 * smoothstep(0.05, 0.0, abs(d - r * 0.68));
    float cells = 0.55 + 0.45 * step(0.5, fract(ang / TAU * 18.0 + d * 3.0));
    float fade = 1.0 - p1;
    col = vColor.rgb * (ring * cells * fade * 1.7 + exp(-d * d * 5.0) * 0.45 * fade * fade);
  } else if (kind < 5.5) {
    // 小圓點
    col = vColor.rgb * (smoothstep(0.5, 0.3, d) * 0.9 + exp(-d * d * 6.0) * 0.4);
  } else if (kind < 6.5) {
    // Copy 型別的值：菱形、四個刻面、內框
    float h = abs(vUv.x) + abs(vUv.y) - 0.52;
    float body = smoothstep(0.02, -0.02, h);
    float edge = smoothstep(0.07, 0.0, abs(h));
    float inner = smoothstep(0.05, 0.0, abs(h + 0.26));
    float facet = 0.35 + 0.4 * step(0.0, vUv.y) + 0.25 * step(0.0, -vUv.x);
    float glow = exp(-d * d * 7.0) * 0.3;
    col = vColor.rgb * (body * (0.14 + 0.3 * facet) + body * inner * 0.5 + edge + glow);
  } else if (kind < 7.5) {
    // GC 掃地機：圓盤、三支刷子、中心的眼
    float ring = smoothstep(0.06, 0.0, abs(d - 0.5));
    float body = smoothstep(0.5, 0.46, d);
    float brush = smoothstep(0.05, 0.0, abs(fract(ang / TAU * 3.0 + 0.5) - 0.5) * d * 3.0) * body * step(0.14, d);
    float eye = smoothstep(0.13, 0.09, d);
    float glow = exp(-d * d * 5.0) * 0.35;
    col = vColor.rgb * (ring + body * 0.1 + brush * 0.7 + eye * 0.9 + glow);
  } else if (kind < 8.5) {
    // 參考變數：一盞小燈。p1 = lit（熄了只剩外框），p2 = solid（&mut 的燈芯較大、較亮）
    float ring = smoothstep(0.07, 0.0, abs(d - 0.44));
    float r = mix(0.13, 0.22, p2);
    float wick = smoothstep(r + 0.05, r, d);
    float outline = smoothstep(0.05, 0.0, abs(d - r));
    float ticks = smoothstep(0.05, 0.0, abs(fract(ang / TAU * 4.0 + 0.5) - 0.5) * d * 4.0)
      * step(0.52, d) * step(d, 0.7);
    float glow = exp(-d * d * 6.0) * 0.45;
    col = vColor.rgb * (ring * mix(0.4, 0.95, p1) + mix(outline * 0.4, wick * 1.1 + glow + ticks * 0.6, p1));
  } else if (kind < 9.5) {
    // 盒子：左右與底三面牆，頂邊是兩片蓋子，各以上方的角為軸往外掀（p1 = open）
    float h = 0.4;
    vec2 q = abs(vUv) - vec2(h);
    float sq = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
    float wall = smoothstep(0.05, 0.0, abs(sq)) * step(vUv.y, h - 0.03);
    float th = p1 * 1.9;
    vec2 pv = vec2(abs(vUv.x) - h, vUv.y - h);
    vec2 dir = vec2(-cos(th), sin(th));
    float lid = smoothstep(0.05, 0.0, length(pv - dir * clamp(dot(pv, dir), 0.0, h)));
    float inside = smoothstep(0.02, -0.02, sq) * 0.08;
    float part = p2 < 0.5 ? 1.0 : (p2 < 1.5 ? step(vUv.x, 0.0) : step(0.0, vUv.x));
    col = vColor.rgb * (wall + lid + inside) * part;
  } else if (kind < 10.5) {
    // 閘門：兩根柱子加半圓的拱；p1 = lit（門內亮起），p2 = ghost（門上打叉）
    vec2 c = vUv - vec2(0.0, 0.1);
    float da = vUv.y > 0.1 ? abs(length(c) - 0.5) : length(vec2(abs(vUv.x) - 0.5, min(vUv.y + 0.6, 0.0)));
    float line = smoothstep(0.07, 0.0, da);
    float inside = vUv.y > 0.1 ? step(length(c), 0.5) : step(abs(vUv.x), 0.5) * step(-0.6, vUv.y);
    float fill = inside * (0.05 + p1 * (0.3 + 0.35 * (0.6 - vUv.y)));
    float cross = smoothstep(0.05, 0.0, abs(abs(vUv.x) - abs(vUv.y + 0.15))) * step(abs(vUv.x), 0.24) * p2;
    col = vColor.rgb * (line + fill + cross * 0.9);
  } else if (kind < 11.5) {
    // 空位：虛線圈，裡面什麼都沒有
    float ring = smoothstep(0.08, 0.0, abs(d - 0.42)) * step(0.45, fract(ang / TAU * 10.0));
    col = vColor.rgb * (ring + exp(-d * d * 6.0) * 0.06);
  } else if (kind < 12.5) {
    // 閃電的頭：十字星芒加亮核
    float rays = smoothstep(0.05, 0.0, abs(vUv.x * vUv.y) * 5.0) * smoothstep(0.9, 0.1, d);
    col = vColor.rgb * (rays * 0.9 + exp(-d * d * 16.0) * 1.5 + exp(-d * d * 5.0) * 0.3);
  } else if (kind < 13.5) {
    // RefCell 的殼：晶體外面的六角框。沒借出時是斷續的細線，登記了借用整圈亮起（borrow_mut 更亮）
    float hs = sdHex(vUv, 0.56);
    float shell = smoothstep(0.04, 0.0, abs(hs));
    float gaps = mix(step(0.42, fract(ang / TAU * 18.0)), 1.0, p1);
    float halo = exp(-pow(hs * 9.0, 2.0)) * 0.45 * p1;
    col = vColor.rgb * (shell * gaps * mix(0.5, 1.1 + 0.5 * p2, p1) + halo);
  } else {
    // 管線的節點：圓環加一道橫槽
    float ring = smoothstep(0.1, 0.0, abs(d - 0.5));
    float slot = smoothstep(0.09, 0.0, abs(vUv.y)) * step(abs(vUv.x), 0.26);
    col = vColor.rgb * (ring + slot * 0.8 + exp(-d * d * 6.0) * 0.15);
  }

  float fade = smoothstep(1.0, 0.86, max(abs(vUv.x), abs(vUv.y)));
  gl_FragColor = vec4(col * vColor.a * fade, 1.0);
}
`;

export const segVert = /* glsl */ `
attribute vec3 iA;
attribute vec3 iB;
attribute vec4 iColor;
attribute vec4 iParam; // width, grow, mode (SEG_*), -
varying vec2 vUv;
varying vec4 vColor;
varying vec4 vParam;
varying float vLen;
void main() {
  vec3 dir = iB - iA;
  float len = length(dir.xy);
  vec2 n = len > 0.0001 ? vec2(-dir.y, dir.x) / len : vec2(0.0, 1.0);
  float u = position.x + 0.5;
  vec3 p = mix(iA, iB, u);
  // 光束往水平方向張開（不是垂直於線段），照在值上的那一端才會剛好蓋住 r0..r1
  bool beam = iParam.z > 2.5;
  p.xy += (beam ? vec2(1.0, 0.0) : n) * position.y * iParam.x * (beam ? mix(iParam.w, 1.0, u) : 1.0);
  vUv = vec2(u, position.y * 2.0);
  vColor = iColor;
  vParam = iParam;
  vLen = len;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

export const segFrag = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying vec4 vColor;
varying vec4 vParam;
varying float vLen;
void main() {
  float core = smoothstep(0.22, 0.0, abs(vUv.y));
  float glow = exp(-vUv.y * vUv.y * 6.0) * 0.3;
  float cut = smoothstep(vParam.y + 0.001, vParam.y - 0.03, vUv.x) * smoothstep(0.0, 0.03, vUv.x);
  float flow = 0.78 + 0.22 * sin(vUv.x * vLen * 5.0 - uTime * 2.5);
  if (vParam.z > 0.5) {
    // 靜止的線（框、軌跡）：不流動、不長出來；z > 1.5 是虛線
    cut = 1.0;
    flow = vParam.z > 1.5 ? step(0.45, fract(vUv.x * vLen * 2.4 + 0.22)) : 1.0;
  }
  float shape = core + glow;
  if (vParam.z > 2.5) {
    // 借用的光束：& 是半透明的光錐加淡淡的邊線，&mut 是實心、邊線更亮
    float a = abs(vUv.y);
    float body = smoothstep(1.0, 0.82, a);
    float rim = smoothstep(0.14, 0.0, abs(a - 0.86));
    float haze = 0.8 + 0.2 * sin(vUv.x * vLen * 7.0 - uTime * 2.0);
    shape = body * mix(0.12 * haze, 0.34, vParam.y) + rim * mix(0.3, 0.9, vParam.y);
    cut = smoothstep(0.0, 0.08, vUv.x);
    flow = 1.0;
  }
  gl_FragColor = vec4(vColor.rgb * shape * cut * flow * vColor.a, 1.0);
}
`;

export const starVert = /* glsl */ `
attribute float aSize;
uniform float uScale;
varying float vDim;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = max(1.0, aSize * uScale / -mv.z);
  vDim = aSize;
  gl_Position = projectionMatrix * mv;
}
`;

export const starFrag = /* glsl */ `
varying float vDim;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.0, d);
  gl_FragColor = vec4(vec3(0.55, 0.65, 0.9) * a * a * (0.25 + 0.5 * vDim), 1.0);
}
`;
