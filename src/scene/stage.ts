// 3D 場景。畫面完全由 stateAt(timeline, t) 決定；
// 唯一不由 t 驅動的是「弄壞它」的拖曳、彈回與力場漣漪，以及 orb 的環境漂移。
// 三個 draw call：星空、線段批次（JS 的線、範圍的框、掃地機的軌跡、借用的光束、閃電、走進閘門的線、
// Rc 的共享線、管線、生命週期的綁線）、貼片批次。
// 沒有變化就不排 rAF。

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderer,
} from 'three';
import {
  breakRange,
  rustClawId,
  rustValId,
  stateAt,
  type Timeline,
  type World,
} from '../core/timeline.ts';
import { localizeLabel } from '../core/localize.ts';
import type { BreakIt } from '../core/trace.ts';
import {
  KIND_BOX,
  KIND_CHIP,
  KIND_CLAW,
  KIND_CRYSTAL,
  KIND_DOT,
  KIND_FIELD,
  KIND_GATE,
  KIND_HOLE,
  KIND_LENS,
  KIND_ORB,
  KIND_SHARD,
  KIND_SHELL,
  KIND_SPARK,
  KIND_SWEEPER,
  KIND_VALVE,
  SEG_BEAM,
  SEG_DASH,
  SEG_FLOW,
  SEG_SOLID,
  segFrag,
  segVert,
  spriteFrag,
  spriteVert,
  starFrag,
  starVert,
} from './shaders.ts';

export interface StageHooks {
  /** 指標指到／離開場景物件（Visual.id） */
  onHover(id: string | null): void;
  /** 「弄壞它」被力場彈開的那一刻 */
  onBreak(): void;
}

type RGB = readonly [number, number, number];
const C_ORB: RGB = [1.0, 0.82, 0.25];
const C_LINK: RGB = [1.0, 0.9, 0.6];
const C_CLAW: RGB = [1.0, 0.45, 0.2];
const C_CRYSTAL: RGB = [0.55, 0.9, 1.0];
const C_ERROR: RGB = [1.0, 0.25, 0.35];
/** `Result` 盒子 `Ok` 那一色 */
const C_OK: RGB = [0.45, 1.0, 0.62];
/** 雙色盒子沒亮的那一半留多少亮度：要看得出是另一種顏色，又明顯比亮的那一半暗 */
const DUO_DIM = 0.55;
/** JS 的空位：暗淡的琥珀色 */
const C_HOLE: RGB = [0.8, 0.62, 0.25];
/** 閃電折幾段、每個轉折往旁邊偏多少 */
const BOLT_KINKS = 6;
const BOLT_JITTER = 0.42;
/** 借用的光束與參考變數：偏白的淡青 */
const C_BEAM: RGB = [0.82, 0.97, 1.0];
/** 光束照在值的哪裡：離值中心多高（晶體上緣外側、標籤下方） */
const BEAM_EDGE = 0.56;
/** 值的寬度：光束的 r0..r1 對應到這一段 */
const BEAM_SPAN = 0.9;

const FOV = 35;
const TAN_HALF = Math.tan((FOV * Math.PI) / 360);
const MAX_SPRITES = 160;
const MAX_SEGS = 96;
const SHARDS = 14;
const CHIP_SHARDS = 6;
const TAU = Math.PI * 2;

const FIELD_MS = 700;
/** 不用拖的弄壞它：力場先亮這麼久，rustc 的訊息才出現（訊息框會蓋住場景下半部） */
const FIELD_LEAD_MS = 420;
const RETURN_MS = 450;
const AUTO_MS = 500;
const BOUNCE_DIST = 1.15;

// 版面。每個世界的內容範圍由 Timeline.bounds 決定；只有一列變數時是
// x ±2.6、y -2.0（變數名）到 +2.7（世界標題），取景中心在垂直中點。
// 有函式框、內層 scope 或一列排不下時 bounds 會變高，取景跟著拉遠。
const DEFAULT_BOUNDS = { halfX: 2.6, y0: -2.0, y1: 2.7 };
/** 兩個世界左右並排時，中間與兩側留的空隙 */
const GAP_X = 0.3;
/** 最外側的標籤離畫面邊緣至少留多少 */
const LABEL_MARGIN = 0.1;
/** 世界標題離內容上緣多遠 */
const TITLE_DROP = 0.2;

interface Pt {
  x: number;
  y: number;
}

const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
};
const rnd = (seed: number, i: number): number => {
  const v = Math.sin(seed * 127.1 + i * 311.7) * 43758.5453;
  return v - Math.floor(v);
};
const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const easeOutBack = (p: number): number => {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2);
};

/** 一個 instanced quad 批次：每個屬性一條 Float32Array，每幀重填 */
class Batch {
  readonly geo = new InstancedBufferGeometry();
  readonly mesh: Mesh;
  private readonly attrs: { arr: Float32Array; size: number; attr: InstancedBufferAttribute }[] = [];
  count = 0;
  private readonly cap: number;

  constructor(cap: number, spec: [string, number][], material: ShaderMaterial) {
    this.cap = cap;
    const quad = new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]);
    this.geo.setAttribute('position', new BufferAttribute(quad, 3));
    this.geo.setIndex([0, 1, 2, 0, 2, 3]);
    for (const [name, size] of spec) {
      const arr = new Float32Array(cap * size);
      const attr = new InstancedBufferAttribute(arr, size);
      attr.setUsage(DynamicDrawUsage);
      this.geo.setAttribute(name, attr);
      this.attrs.push({ arr, size, attr });
    }
    this.geo.instanceCount = 0;
    this.mesh = new Mesh(this.geo, material);
    this.mesh.frustumCulled = false;
  }

  /** 依屬性宣告的順序攤平寫入一筆 */
  push(values: number[]): void {
    if (this.count >= this.cap) return;
    let o = 0;
    for (const a of this.attrs) {
      for (let j = 0; j < a.size; j++) a.arr[this.count * a.size + j] = values[o++] ?? 0;
    }
    this.count++;
  }

  flush(): void {
    for (const a of this.attrs) a.attr.needsUpdate = true;
    this.geo.instanceCount = this.count;
  }

  dispose(): void {
    this.geo.dispose();
  }
}

const additive = (vertexShader: string, fragmentShader: string, uniforms: ShaderMaterial['uniforms']) =>
  new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    blending: AdditiveBlending,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

/** 舞台上由程式產生的文字，依介面語言由 UI 設定 */
export interface StageTexts {
  jsWorld: string;
  rustWorld: string;
  /** 引用計數標籤的前綴：`計數 2`、`count 2` */
  count: string;
  /** 軌跡裡的標籤 → 這個語言的寫法；沒有要換的就省略 */
  labels?: Record<string, string>;
}

const DEFAULT_TEXTS: StageTexts = { jsWorld: 'JS 世界', rustWorld: 'Rust 世界', count: '計數' };

export class Stage {
  private readonly canvas: HTMLCanvasElement;
  private readonly labels: HTMLElement;
  private readonly hooks: StageHooks;

  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(FOV, 1, 0.1, 200);
  private readonly uTime = { value: 0 };
  private readonly uStarScale = { value: 1 };
  private readonly spriteMat: ShaderMaterial;
  private readonly segMat: ShaderMaterial;
  private readonly starMat: ShaderMaterial;
  private readonly sprites: Batch;
  private readonly segs: Batch;
  private readonly starGeo = new BufferGeometry();
  private readonly ro: ResizeObserver;
  private readonly motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly v3 = new Vector3();

  private tl: Timeline | null = null;
  private breakIt: BreakIt | null = null;
  private range: { from: number; to: number } | null = null;
  private t = 0;
  private hl: ReadonlySet<string> | null = null;
  private texts: StageTexts = DEFAULT_TEXTS;

  private w = 1;
  private h = 1;
  private wide = true;
  private dist = 20;
  private bounds = DEFAULT_BOUNDS;
  /** 最長的標籤往世界外側伸到多遠（Timeline.reachX） */
  private reachX = 0;
  /** 取景中心的 y */
  private viewCy = 0.35;
  /** 世界中心離畫面中心多遠：寬螢幕左右擺、窄螢幕上下擺 */
  private worldX = 2.9;
  private worldY = 2.7;
  private raf = 0;
  private last = 0;
  private disposed = false;

  private time = 0;
  private timeScale = 0;
  private pointerIn = false;
  private ndc: Pt = { x: 0, y: 0 };
  private cam: Pt = { x: 0, y: 0 };

  private hits: { id: string; sx: number; sy: number; r: number }[] = [];
  private hoverId: string | null = null;

  private mode: 'idle' | 'drag' | 'auto' | 'return' = 'idle';
  private ov: Pt | null = null;
  private animFrom: Pt = { x: 0, y: 0 };
  private animStart = 0;
  private field: { start: number; x: number; y: number } | null = null;
  /** 力場亮完前段之後要通知 onBreak 的時間點；沒有待通知的就是 null */
  private notifyAt: number | null = null;
  private dragBase: Pt | null = null;
  private dragTarget: Pt | null = null;
  private breakable = false;
  private capturedPointer: number | null = null;

  private readonly spans = new Map<string, HTMLSpanElement>();

  constructor(canvas: HTMLCanvasElement, labels: HTMLElement, hooks: StageHooks) {
    this.canvas = canvas;
    this.labels = labels;
    this.hooks = hooks;

    // WebGL 不可用時這裡會 throw，由呼叫端顯示替代內容
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setClearColor(0x07080c, 1);

    this.spriteMat = additive(spriteVert, spriteFrag, {});
    this.segMat = additive(segVert, segFrag, { uTime: this.uTime });
    this.starMat = additive(starVert, starFrag, { uScale: this.uStarScale });

    const starCount = 300;
    const pos = new Float32Array(starCount * 3);
    const size = new Float32Array(starCount);
    for (let i = 0; i < starCount; i++) {
      pos[i * 3] = (rnd(1.37, i) - 0.5) * 60;
      pos[i * 3 + 1] = (rnd(2.71, i) - 0.5) * 36;
      pos[i * 3 + 2] = -4 - rnd(3.19, i) * 30;
      size[i] = 0.25 + rnd(4.43, i) * 0.75;
    }
    this.starGeo.setAttribute('position', new BufferAttribute(pos, 3));
    this.starGeo.setAttribute('aSize', new BufferAttribute(size, 1));
    const stars = new Points(this.starGeo, this.starMat);
    stars.frustumCulled = false;

    this.segs = new Batch(MAX_SEGS, [['iA', 3], ['iB', 3], ['iColor', 4], ['iParam', 4]], this.segMat);
    this.sprites = new Batch(
      MAX_SPRITES,
      [['iPos', 3], ['iColor', 4], ['iParam', 4], ['iRot', 1]],
      this.spriteMat,
    );
    this.scene.add(stars, this.segs.mesh, this.sprites.mesh);

    canvas.addEventListener('pointerenter', this.onEnter);
    canvas.addEventListener('pointerleave', this.onLeave);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onUp);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.motion.addEventListener('change', this.invalidate);

    this.ro = new ResizeObserver(this.resize);
    this.ro.observe(canvas.parentElement ?? canvas);
    this.resize();
  }

  setTimeline(tl: Timeline, breakIt: BreakIt | null): void {
    this.tl = tl;
    this.breakIt = breakIt;
    this.range = breakIt ? breakRange(tl, breakIt) : null;
    this.bounds = tl.bounds;
    this.reachX = tl.reachX;
    this.layoutView();
    this.cancelInteraction();
    this.field = null;
    this.notifyAt = null;
    for (const [id, el] of this.spans) {
      if (!id.startsWith('title:')) {
        el.remove();
        this.spans.delete(id);
      }
    }
    this.invalidate();
  }

  /** 換語言：世界標題、計數標籤、軌跡標籤的對照表。下一幀就換，不動時間軸 */
  setTexts(texts: StageTexts): void {
    this.texts = texts;
    this.invalidate();
  }

  setT(t: number): void {
    if (t === this.t) return;
    this.t = t;
    this.cancelInteraction();
    this.invalidate();
  }

  setHighlight(ids: ReadonlySet<string> | null): void {
    this.hl = ids && ids.size > 0 ? ids : null;
    this.invalidate();
  }

  /**
   * 示範一次弄壞它；不在可弄壞的範圍內就什麼都不做。
   * 可以拖的（breakIt.drag）自動把值拖過去再被彈開；不能拖的直接在 breakIt.at 放力場。
   */
  tryBreak(): void {
    if (this.mode !== 'idle' || !this.computeBreakable()) return;
    if (this.breakIt!.drag && this.refreshDragPoints()) {
      this.mode = 'auto';
      this.animStart = performance.now();
      this.ov = { ...this.dragBase! };
    } else {
      this.breakAt(performance.now());
    }
    this.invalidate();
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    const c = this.canvas;
    c.removeEventListener('pointerenter', this.onEnter);
    c.removeEventListener('pointerleave', this.onLeave);
    c.removeEventListener('pointermove', this.onMove);
    c.removeEventListener('pointerdown', this.onDown);
    c.removeEventListener('pointerup', this.onUp);
    c.removeEventListener('pointercancel', this.onUp);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.motion.removeEventListener('change', this.invalidate);
    for (const el of this.spans.values()) el.remove();
    this.spans.clear();
    this.sprites.dispose();
    this.segs.dispose();
    this.starGeo.dispose();
    this.spriteMat.dispose();
    this.segMat.dispose();
    this.starMat.dispose();
    this.renderer.dispose();
  }

  // ---- 排程 ----

  private readonly invalidate = (): void => {
    if (this.raf || this.disposed || document.hidden) return;
    this.raf = requestAnimationFrame(this.frame);
  };

  private readonly onVisibility = (): void => {
    if (!document.hidden) this.invalidate();
  };

  private readonly resize = (): void => {
    const box = this.canvas.parentElement ?? this.canvas;
    const w = box.clientWidth;
    const h = box.clientHeight;
    if (w < 2 || h < 2) return;
    this.w = w;
    this.h = h;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.uStarScale.value = h * dpr * 0.09;
    this.layoutView();
    this.invalidate();
  };

  /** 依畫面比例與內容範圍決定兩個世界怎麼擺、相機離多遠 */
  private layoutView(): void {
    const { halfX, y0, y1 } = this.bounds;
    const aspect = this.w / this.h;
    const span = (y1 - y0) / 2;
    this.wide = aspect >= 1.25;
    this.viewCy = (y0 + y1) / 2;
    this.worldX = halfX + GAP_X;
    this.worldY = span + 0.35;
    // 預設範圍下：寬螢幕半寬 5.3、半高 2.8；窄螢幕半寬 2.9、半高 5.4
    // 標籤比內容範圍伸得更遠時（最外側那一欄的值名字很長），取景再放寬到剛好容得下它
    const outer = Math.max(halfX - 0.2, this.reachX + LABEL_MARGIN);
    const halfW = this.wide ? this.worldX + outer : Math.max(halfX + GAP_X, this.reachX + LABEL_MARGIN);
    const halfH = this.wide ? span + 0.45 : this.worldY * 2;
    this.dist = Math.max(halfH / TAN_HALF, halfW / (TAN_HALF * aspect));
  }

  // ---- 座標 ----

  private offset(world: World): Pt {
    if (this.wide) return { x: world === 'js' ? -this.worldX : this.worldX, y: 0 };
    return { x: 0, y: world === 'js' ? this.worldY : -this.worldY };
  }

  private toScreen(x: number, y: number): Pt {
    const v = this.v3.set(x, y, 0).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * this.w, y: (-v.y * 0.5 + 0.5) * this.h };
  }

  /** 指標反投影到 z=0 平面 */
  private toWorld(ndc: Pt): Pt {
    const v = this.v3.set(ndc.x, ndc.y, 0.5).unproject(this.camera);
    const c = this.camera.position;
    const k = -c.z / (v.z - c.z);
    return { x: c.x + (v.x - c.x) * k, y: c.y + (v.y - c.y) * k };
  }

  private readNdc(e: PointerEvent): Pt {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / Math.max(r.width, 1)) * 2 - 1,
      y: -(((e.clientY - r.top) / Math.max(r.height, 1)) * 2 - 1),
    };
  }

  // ---- 指標 ----

  private readonly onEnter = (): void => {
    this.pointerIn = true;
    this.invalidate();
  };

  private readonly onLeave = (): void => {
    this.pointerIn = false;
    this.setHover(null);
    this.invalidate();
  };

  private readonly onMove = (e: PointerEvent): void => {
    this.pointerIn = true;
    this.ndc = this.readNdc(e);
    if (this.mode === 'drag') {
      this.ov = this.toWorld(this.ndc);
    } else {
      this.setHover(this.pick(e));
    }
    this.invalidate();
  };

  private readonly onDown = (e: PointerEvent): void => {
    this.ndc = this.readNdc(e);
    const id = this.pick(e);
    this.setHover(id);
    if (this.mode === 'idle' && this.breakIt && this.breakable && id !== null) {
      if (id === this.dragId()) {
        this.mode = 'drag';
        this.ov = this.toWorld(this.ndc);
        this.capturedPointer = e.pointerId;
        this.canvas.setPointerCapture(e.pointerId);
        e.preventDefault();
      } else if (!this.breakIt.drag && id === this.breakIt.at) {
        // 不能拖的弄壞它：直接點那個物件也算
        this.breakAt(performance.now());
      }
    }
    this.updateCursor();
    this.invalidate();
  };

  private readonly onUp = (): void => {
    this.releaseCapture();
    if (this.mode === 'drag') this.startReturn(performance.now());
    this.updateCursor();
    this.invalidate();
  };

  private pick(e: PointerEvent): string | null {
    const r = this.canvas.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    let best: { id: string; r: number; d: number } | null = null;
    for (const hit of this.hits) {
      const d = Math.hypot(hit.sx - px, hit.sy - py);
      if (d > hit.r) continue;
      // 重疊時（晶體在夾具中心）半徑小的優先
      if (!best || hit.r < best.r || (hit.r === best.r && d < best.d)) best = { id: hit.id, r: hit.r, d };
    }
    return best?.id ?? null;
  }

  private setHover(id: string | null): void {
    if (id === this.hoverId) return;
    this.hoverId = id;
    this.updateCursor();
    this.hooks.onHover(id);
  }

  private updateCursor(): void {
    let cursor = '';
    if (this.mode === 'drag') cursor = 'grabbing';
    else if (this.hoverId && this.hoverId === this.dragId() && this.breakable) cursor = 'grab';
    else if (this.hoverId) cursor = 'pointer';
    if (this.canvas.style.cursor !== cursor) this.canvas.style.cursor = cursor;
  }

  // ---- 弄壞它 ----

  /** 可以拖的那顆值的畫面 id；這一頁的弄壞它不是用拖的就是 null */
  private dragId(): string | null {
    return this.breakIt?.drag ? rustValId(this.breakIt.drag.value) : null;
  }

  /** 在 breakIt.at 的位置放力場漣漪，稍後通知外面顯示 rustc 的訊息 */
  private breakAt(now: number): void {
    if (!this.tl || !this.breakIt) return;
    const at = stateAt(this.tl, this.t).find((v) => v.id === this.breakIt!.at);
    const off = this.offset(at?.world ?? 'rust');
    this.field = { start: now, x: (at?.n.x ?? 0) + off.x, y: (at?.n.y ?? 0) + off.y };
    this.notifyAt = now + (this.motion.matches ? 0 : FIELD_LEAD_MS);
  }

  private computeBreakable(): boolean {
    const r = this.range;
    return !!(this.tl && this.breakIt && r && this.t >= r.from && this.t <= r.to);
  }

  /** 以目前的 t 算出被拖的晶體與目標夾具的世界座標；任一不存在就回傳 false */
  private refreshDragPoints(): boolean {
    this.dragBase = null;
    this.dragTarget = null;
    const drag = this.breakIt?.drag;
    if (!this.tl || !drag) return false;
    const off = this.offset('rust');
    for (const v of stateAt(this.tl, this.t)) {
      if (v.id === rustValId(drag.value) && v.n.shatter < 0.01 && v.n.alpha > 0.5)
        this.dragBase = { x: v.n.x + off.x, y: v.n.y + off.y };
      if (v.id === rustClawId(drag.onto) && v.n.alpha > 0.5)
        this.dragTarget = { x: v.n.x + off.x, y: v.n.y + off.y };
    }
    return !!(this.dragBase && this.dragTarget);
  }

  private releaseCapture(): void {
    if (this.capturedPointer === null) return;
    if (this.canvas.hasPointerCapture(this.capturedPointer))
      this.canvas.releasePointerCapture(this.capturedPointer);
    this.capturedPointer = null;
  }

  private cancelInteraction(): void {
    this.releaseCapture();
    this.mode = 'idle';
    this.ov = null;
    this.updateCursor();
  }

  private startReturn(now: number): void {
    this.mode = 'return';
    this.animFrom = this.ov ? { ...this.ov } : { ...(this.dragBase ?? { x: 0, y: 0 }) };
    this.animStart = now;
  }

  private bounce(now: number): void {
    const target = this.dragTarget!;
    this.field = { start: now, x: target.x, y: target.y };
    this.releaseCapture();
    this.startReturn(now);
    this.updateCursor();
    this.hooks.onBreak();
  }

  private stepInteraction(now: number): void {
    if (this.mode === 'idle') return;
    const base = this.dragBase;
    const target = this.dragTarget;
    if (!base || !target || !this.breakable) {
      this.cancelInteraction();
      return;
    }
    if (this.mode === 'drag') {
      if (this.ov && Math.hypot(this.ov.x - target.x, this.ov.y - target.y) < BOUNCE_DIST) this.bounce(now);
    } else if (this.mode === 'auto') {
      const p = Math.min(1, (now - this.animStart) / AUTO_MS);
      const q = Math.min(0.8, p * p);
      this.ov = { x: base.x + (target.x - base.x) * q, y: base.y + (target.y - base.y) * q + Math.sin(q * Math.PI) * 0.5 };
      if (p * p >= 0.8) this.bounce(now);
    } else {
      const p = (now - this.animStart) / RETURN_MS;
      if (p >= 1) {
        this.mode = 'idle';
        this.ov = null;
        this.updateCursor();
      } else {
        const e = easeOutBack(p);
        this.ov = {
          x: this.animFrom.x + (base.x - this.animFrom.x) * e,
          y: this.animFrom.y + (base.y - this.animFrom.y) * e,
        };
      }
    }
  }

  // ---- 每幀 ----

  private readonly frame = (now: number): void => {
    this.raf = 0;
    if (this.disposed) return;
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0;
    this.last = now;
    const reduced = this.motion.matches;

    this.breakable = this.computeBreakable();
    // 只有可以拖的時候才攔下觸控捲動
    const touch = this.breakable && this.breakIt?.drag ? 'none' : 'pan-y';
    if (this.canvas.style.touchAction !== touch) this.canvas.style.touchAction = touch;
    if (this.mode !== 'idle' || this.breakable) this.refreshDragPoints();
    this.stepInteraction(now);
    if (this.notifyAt !== null && now >= this.notifyAt) {
      this.notifyAt = null;
      // 等待期間滑桿被拖出可弄壞的範圍就不通知了
      if (this.breakable) this.hooks.onBreak();
    }
    if (this.field && now - this.field.start >= FIELD_MS) this.field = null;

    // 環境時間：只在指標在場景上或有互動動畫時前進
    const busy = this.mode !== 'idle' || this.field !== null || this.notifyAt !== null;
    const target = !reduced && (this.pointerIn || busy) ? 1 : 0;
    this.timeScale += (target - this.timeScale) * Math.min(1, dt * 4);
    if (target === 0 && this.timeScale < 0.002) this.timeScale = 0;
    this.time += dt * this.timeScale;
    this.uTime.value = this.time;

    // 相機視差
    const cx = this.pointerIn && !reduced ? this.ndc.x * 0.5 : 0;
    const cy = this.pointerIn && !reduced ? this.ndc.y * 0.35 : 0;
    const k = reduced ? 1 : Math.min(1, dt * 6);
    this.cam.x += (cx - this.cam.x) * k;
    this.cam.y += (cy - this.cam.y) * k;
    const camMoving = Math.abs(cx - this.cam.x) + Math.abs(cy - this.cam.y) > 0.001;
    this.camera.position.set(this.cam.x, this.viewCy + this.cam.y, this.dist);
    this.camera.lookAt(0, this.viewCy, 0);
    this.camera.updateMatrixWorld();

    this.fill(now);
    this.renderer.render(this.scene, this.camera);

    if (target === 1 || this.timeScale > 0 || camMoving || busy) this.invalidate();
    else this.last = 0;
  };

  private fill(now: number): void {
    const visuals = this.tl ? stateAt(this.tl, this.t) : [];
    const sprites = this.sprites;
    const segs = this.segs;
    sprites.count = 0;
    segs.count = 0;
    this.hits = [];
    const pxPerUnit = this.h / (2 * TAN_HALF * this.dist);
    const dragId = this.dragId();
    const used = new Set<string>();

    // 第一輪：世界座標（光球的漂移、被拖曳的晶體）
    const pos = new Map<string, Pt>();
    for (const v of visuals) {
      const off = this.offset(v.world);
      let x = v.n.x + off.x;
      let y = v.n.y + off.y;
      if (v.kind === 'orb') {
        const seed = hash(v.id) * TAU;
        y += Math.sin(this.time * 0.9 + seed) * 0.07 * (1 + 2 * v.n.loose);
        x += Math.cos(this.time * 0.6 + seed) * 0.04 * (1 + 3 * v.n.loose);
      } else if (v.kind === 'bead') {
        // primitive 貼在變數上，只輕輕晃
        y += Math.sin(this.time * 0.9 + hash(v.id) * TAU) * 0.025;
      } else if (v.id === dragId && this.ov) {
        x = this.ov.x;
        y = this.ov.y;
      }
      pos.set(v.id, { x, y });
    }

    const sprite = (
      p: Pt, size: number, kind: number, c: RGB, bright: number, alpha: number, p1 = 0, p2 = 0, rot = 0,
    ) => sprites.push([p.x, p.y, 0, c[0] * bright, c[1] * bright, c[2] * bright, alpha, size, kind, p1, p2, rot]);

    // 第二輪：填批次、標籤、可指的範圍
    for (const v of visuals) {
      const n = v.n;
      const p = pos.get(v.id)!;
      const lit = this.hl ? this.hl.has(v.id) : false;
      const bright = (this.hl ? (lit ? 1.5 : 0.45) : 1) * (1 + 0.5 * n.pulse);
      const scale = (lit ? 1.08 : 1) * (1 + 0.12 * n.pulse);
      const grown = 0.7 + 0.3 * n.alpha;
      let labelX = 0;
      let labelY = 0;
      let labelAlpha = n.alpha;
      let labelCls = '';
      let hitR = 0;

      switch (v.kind) {
        case 'orb': {
          // swept：被掃地機收走，邊縮邊消失
          const left = 1 - n.swept;
          sprite(
            p, 1.7 * grown * scale * (0.5 + 0.5 * left), KIND_ORB, C_ORB, bright,
            n.alpha * (1 - 0.5 * n.loose) * left, 0, n.loose,
          );
          labelY = 0.95;
          labelAlpha = n.alpha * left;
          hitR = left > 0.5 ? 0.6 : 0;
          break;
        }
        case 'bead':
          sprite(p, 0.85 * grown * scale * (1 + 0.1 * n.flight), KIND_ORB, C_ORB, bright, n.alpha);
          labelY = 0.42;
          hitR = 0.32;
          break;
        case 'frame': {
          // 四條邊；函式是實線，內層的 { } 是虛線。名字放在左上角外側；
          // JS 的框改放左下角外側（變數連到值的線會從上緣穿出去，劃過放在上面的名字）
          const c = v.world === 'rust' ? C_CLAW : C_ORB;
          const x0 = p.x - n.w / 2;
          const x1 = p.x + n.w / 2;
          const y0 = p.y - n.h / 2;
          const y1 = p.y + n.h / 2;
          const mode = n.dash > 0.5 ? SEG_DASH : SEG_SOLID;
          const edge = (ax: number, ay: number, bx: number, by: number) =>
            segs.push([ax, ay, 0, bx, by, 0, c[0] * bright, c[1] * bright, c[2] * bright, n.alpha * 0.5, 0.1, 1, mode, 0]);
          edge(x0, y0, x1, y0);
          edge(x1, y0, x1, y1);
          edge(x1, y1, x0, y1);
          edge(x0, y1, x0, y0);
          labelX = -n.w / 2;
          labelY = v.world === 'js' ? -n.h / 2 : n.h / 2;
          if (v.world === 'js') labelCls = ' is-below';
          break;
        }
        case 'sweeper': {
          const off = this.offset(v.world);
          const tail = p.x - 0.4;
          if (tail > n.x2 + off.x)
            segs.push([
              n.x2 + off.x, p.y, 0, tail, p.y, 0,
              C_LINK[0], C_LINK[1], C_LINK[2], n.alpha * 0.3, 0.12, 1, SEG_DASH, 0,
            ]);
          // 轉的角度跟著位置走，所以往回拖時它會倒著轉
          sprite(p, 1.3, KIND_SWEEPER, C_ORB, 1, n.alpha, 0, 0, -v.n.x * 2.2);
          labelY = 0.8;
          break;
        }
        case 'tag':
          sprite(p, 0.42 * scale, KIND_DOT, C_LINK, bright, n.alpha);
          labelY = -0.45;
          hitR = 0.4;
          break;
        case 'link': {
          const off = this.offset(v.world);
          const end = (v.ref ? pos.get(v.ref) : undefined) ?? { x: n.x2 + off.x, y: n.y2 + off.y };
          const ax = p.x;
          const ay = p.y + 0.18;
          const dx = end.x - ax;
          const dy = end.y - ay;
          const len = Math.hypot(dx, dy);
          const cut = len > 0.5 ? (len - 0.42) / len : 1;
          segs.push([
            ax, ay, 0, ax + dx * cut, ay + dy * cut, 0,
            C_LINK[0] * bright, C_LINK[1] * bright, C_LINK[2] * bright, n.alpha * 0.85,
            0.16 * scale, n.grow, SEG_FLOW, 0,
          ]);
          break;
        }
        case 'lens':
          // 參考變數：不握值的小燈；借用結束後只剩外框
          sprite(p, 0.95 * scale, KIND_LENS, C_BEAM, bright * (1 + 0.3 * n.solid * n.lit), n.alpha, n.lit, n.solid);
          labelY = 0.44;
          hitR = 0.36;
          break;
        case 'beam': {
          // 光錐從燈張開到值上被照到的那一段（r0..r1），值的邊上再畫一條亮線標出範圍。
          // 亮度完全由 alpha × lit 決定，所以亮起與熄滅都可以倒著拖
          const k = n.alpha * n.lit;
          if (k < 0.004) break;
          const off = this.offset(v.world);
          const target = (v.ref ? pos.get(v.ref) : undefined) ?? { x: n.x2 + off.x, y: n.y2 + off.y };
          const fy = target.y + (p.y >= target.y ? BEAM_EDGE : -BEAM_EDGE);
          const fx0 = target.x + (n.r0 - 0.5) * BEAM_SPAN;
          const fx1 = target.x + (n.r1 - 0.5) * BEAM_SPAN;
          const cx = (fx0 + fx1) / 2;
          const dx = cx - p.x;
          const dy = fy - p.y;
          const len = Math.hypot(dx, dy) || 1;
          // 光束的四邊形兩端是水平的；由下往上照時（cell-use 從夾具照到上方的值）寬度取負，頂點順序才不會反過來被剔除
          const wEnd = Math.max(0.12, fx1 - fx0) * (p.y >= fy ? 1 : -1);
          const b = bright * (1 + 0.6 * n.solid);
          const rgb = [C_BEAM[0] * b, C_BEAM[1] * b, C_BEAM[2] * b];
          segs.push([
            p.x + (dx / len) * 0.22, p.y + (dy / len) * 0.22, 0, cx, fy, 0,
            ...rgb, k, wEnd, n.solid, SEG_BEAM, 0.1 / Math.abs(wEnd),
          ]);
          // slice：先畫整顆值的淡淡底線，才看得出只照到其中一段
          if (n.r1 - n.r0 < 0.999)
            segs.push([
              target.x - BEAM_SPAN / 2, fy, 0, target.x + BEAM_SPAN / 2, fy, 0,
              ...rgb, k * 0.35, 0.1, 1, SEG_SOLID, 0,
            ]);
          segs.push([fx0, fy, 0, fx1, fy, 0, ...rgb, k * (0.8 + 0.2 * n.solid), 0.24, 1, SEG_SOLID, 0]);
          break;
        }
        case 'note':
          // 只有文字（引用計數）：標籤就在這個位置
          break;
        case 'item':
          // 流過管線的值：小菱形，標籤在下方（上方是每一段的名字）
          sprite(p, 0.95 * scale, KIND_CHIP, C_CRYSTAL, bright, n.alpha);
          labelY = -0.45;
          break;
        case 'pipe': {
          // 管線的一段：從上一個節點（或入口）長到這一段的節點，長度跟著 grow 走，所以接上去可以倒著拖
          const off = this.offset(v.world);
          segs.push([
            n.x2 + off.x, n.y2 + off.y, 0, p.x, p.y, 0,
            C_CLAW[0] * bright, C_CLAW[1] * bright, C_CLAW[2] * bright, n.alpha * 0.7, 0.16, n.grow, SEG_FLOW, 0,
          ]);
          // 出口那一段（沒有名字）沒有節點
          if (v.label) {
            const a = n.alpha * smooth(0.6, 1, n.grow);
            sprite(p, 0.8 * scale, KIND_VALVE, C_CLAW, bright, a);
            labelY = 0.46;
            labelAlpha = a;
            hitR = 0.3;
          }
          break;
        }
        case 'tether': {
          // 生命週期的綁線：從參考變數的燈到它綁著的值的虛線，值的邊上一條短線標出「最多活到這裡」。
          // 亮度跟光束一樣是 alpha × lit
          const k = n.alpha * n.lit;
          labelAlpha = k;
          const off = this.offset(v.world);
          const target = (v.ref ? pos.get(v.ref) : undefined) ?? { x: n.x2 + off.x, y: n.y2 + off.y };
          const fy = target.y + (p.y >= target.y ? 0.66 : -0.66);
          // 名字放在綁線靠燈那一側的右邊
          labelX = (target.x - p.x) * 0.35 + 0.45;
          labelY = (fy - p.y) * 0.35;
          if (k < 0.004) break;
          const dx = target.x - p.x;
          const dy = fy - p.y;
          const len = Math.hypot(dx, dy) || 1;
          const rgb = [C_BEAM[0] * bright, C_BEAM[1] * bright, C_BEAM[2] * bright];
          segs.push([
            p.x + (dx / len) * 0.3, p.y + (dy / len) * 0.3, 0, target.x, fy, 0,
            ...rgb, k * 0.75, 0.12, 1, SEG_DASH, 0,
          ]);
          segs.push([target.x - 0.34, fy, 0, target.x + 0.34, fy, 0, ...rgb, k * 0.8, 0.2, 1, SEG_SOLID, 0]);
          break;
        }
        case 'box': {
          // 盒子畫在夾具裡、值在盒子裡。值被交出去之後（ghost）整個變暗。
          // 雙色盒子用兩片拼：左半 Ok、右半 Err，這次的變體那一半亮、另一半暗
          const a = n.alpha * (1 - 0.55 * n.ghost);
          const size = 2.5 * scale;
          if (n.duo > 0.5) {
            sprite(p, size, KIND_BOX, C_OK, bright * (1 - (1 - DUO_DIM) * n.err), a, n.open, 1);
            sprite(p, size, KIND_BOX, C_ERROR, bright * (DUO_DIM + (1 - DUO_DIM) * n.err), a, n.open, 2);
          } else {
            sprite(p, size, KIND_BOX, C_CLAW, bright, a, n.open, 0);
          }
          // 變體的名字放在夾具下方的缺口裡
          labelY = -0.74;
          labelAlpha = a;
          hitR = 0.45;
          break;
        }
        case 'gate': {
          const c = v.world === 'rust' ? C_CLAW : C_ORB;
          const b = bright * (1 - 0.6 * n.ghost) * (1 + 0.8 * n.lit);
          sprite(p, 1.25 * scale, KIND_GATE, c, b, n.alpha, n.lit, n.ghost);
          if (n.lit > 0.004) {
            // 值走進這一道：從被比對的值拉一條線進門，長度跟著 lit 走
            const off = this.offset(v.world);
            segs.push([
              n.x2 + off.x, n.y2 + off.y + 0.6, 0, p.x, p.y - 0.42, 0,
              c[0] * bright, c[1] * bright, c[2] * bright, n.alpha * 0.8, 0.14, n.lit, SEG_FLOW, 0,
            ]);
          }
          labelY = 0.62;
          labelAlpha = n.alpha * (1 - 0.45 * n.ghost);
          hitR = 0.4;
          break;
        }
        case 'hole':
          sprite(p, 0.85 * scale, KIND_HOLE, C_HOLE, bright, n.alpha * 0.9);
          // 名字靠在右邊（.lbl-hole 靠左對齊）：正上方是閃電劈出去的路
          labelX = 0.38;
          hitR = 0.32;
          break;
        case 'bolt': {
          // 折線：轉折的位置由 id 決定（每次畫都一樣），只畫到 grow 的比例，所以可以倒著拖
          const off = this.offset(v.world);
          const dx = n.x2 + off.x - p.x;
          const dy = n.y2 + off.y - p.y;
          const len = Math.hypot(dx, dy) || 1;
          const seed = hash(v.id) * 10 + 1;
          let prev = p;
          for (let i = 1; i <= BOLT_KINKS; i++) {
            const g = Math.min(1, n.grow * BOLT_KINKS - (i - 1));
            if (g <= 0) break;
            const u = i / BOLT_KINKS;
            const j = i === BOLT_KINKS ? 0 : (rnd(seed, i) - 0.5) * BOLT_JITTER;
            const pt = { x: p.x + dx * u - (dy / len) * j, y: p.y + dy * u + (dx / len) * j };
            segs.push([
              prev.x, prev.y, 0, prev.x + (pt.x - prev.x) * g, prev.y + (pt.y - prev.y) * g, 0,
              C_ERROR[0] * bright, C_ERROR[1] * bright, C_ERROR[2] * bright, n.alpha, 0.2, 1, SEG_SOLID, 0,
            ]);
            prev = pt;
          }
          break;
        }
        case 'spark':
          sprite(p, 1.15 * scale, KIND_SPARK, C_ERROR, bright, n.alpha);
          labelY = 0.45;
          hitR = 0.3;
          break;
        case 'claw':
          sprite(p, 1.9 * scale, KIND_CLAW, C_CLAW, bright, n.alpha, n.grip, n.ghost);
          labelY = -1.2;
          hitR = 0.95;
          break;
        case 'crystal':
        case 'chip': {
          // chip（Copy 型別）比晶體小、形狀不同，碎的時候碎片也少、飛得近
          const chip = v.kind === 'chip';
          const shards = chip ? CHIP_SHARDS : SHARDS;
          const reach = chip ? 0.55 : 1;
          const s = n.shatter;
          const body = n.alpha * (1 - smooth(0, 0.25, s));
          if (body > 0.003)
            sprite(
              p, (chip ? 1.3 : 2.0) * grown * scale * (1 + 0.1 * n.flight),
              chip ? KIND_CHIP : KIND_CRYSTAL, C_CRYSTAL, bright, body,
            );
          // RefCell 的殼：跟著晶體一起出現、一起碎；登記著借用時亮起（lent），borrow_mut 更亮（solid）
          if (n.cell > 0.5 && body > 0.003)
            sprite(p, 2.0 * grown * scale, KIND_SHELL, C_BEAM, bright, body, n.lent, n.solid * n.lent);
          if (s > 0.001 && s < 0.999) {
            const seed = hash(v.id) * 10 + 1;
            const out = 1 - Math.pow(1 - s, 3);
            const a = n.alpha * Math.min(1, s * 8) * Math.pow(1 - s, 1.2);
            for (let i = 0; i < shards; i++) {
              const r1 = rnd(seed, i);
              const r2 = rnd(seed + 3.1, i);
              const r3 = rnd(seed + 7.7, i);
              const ang = TAU * (i / shards + 0.3 * (r1 - 0.5));
              const d = out * (0.6 + 1.6 * r2) * reach;
              sprite(
                { x: p.x + Math.cos(ang) * d, y: p.y + Math.sin(ang) * d - 0.9 * s * s * reach },
                (0.3 + 0.3 * r2) * (chip ? 0.7 : 1), KIND_SHARD, C_CRYSTAL, bright, a, 0, 0,
                r3 * TAU + s * 5 * (r1 - 0.5),
              );
            }
          }
          labelY = 0.85;
          labelAlpha = n.alpha * (1 - s);
          hitR = s < 0.5 ? (chip ? 0.4 : 0.5) : 0;
          break;
        }
      }

      if (hitR > 0 && n.alpha > 0.3) {
        const sp = this.toScreen(p.x, p.y);
        this.hits.push({ id: v.id, sx: sp.x, sy: sp.y, r: Math.max(16, hitR * pxPerUnit) });
      }
      if (v.label) {
        used.add(v.id);
        this.label(
          v.id, `lbl lbl-${v.kind}${labelCls}`,
          v.count !== undefined ? `${this.texts.count} ${v.count}` : localizeLabel(v.label, this.texts.labels),
          p.x + labelX, p.y + labelY, labelAlpha * (this.hl && !lit ? 0.6 : 1),
        );
      }
    }

    if (this.field) {
      const pr = Math.min(1, (now - this.field.start) / FIELD_MS);
      sprite(this.field, 4.6, KIND_FIELD, C_ERROR, 1, 1, pr);
    }

    for (const world of ['js', 'rust'] as const) {
      const off = this.offset(world);
      const id = `title:${world}`;
      used.add(id);
      this.label(
        id, 'lbl lbl-world', world === 'js' ? this.texts.jsWorld : this.texts.rustWorld,
        off.x, off.y + this.bounds.y1 - TITLE_DROP, this.tl ? 1 : 0,
      );
    }
    for (const [id, el] of this.spans) {
      if (!used.has(id) && el.style.opacity !== '0') el.style.opacity = '0';
    }

    sprites.flush();
    segs.flush();
    this.updateCursor();
  }

  private label(id: string, cls: string, text: string, x: number, y: number, alpha: number): void {
    let el = this.spans.get(id);
    if (!el) {
      el = document.createElement('span');
      el.className = cls;
      this.labels.appendChild(el);
      this.spans.set(id, el);
    }
    if (el.textContent !== text) el.textContent = text;
    const opacity = alpha < 0.02 ? '0' : alpha.toFixed(2);
    if (el.style.opacity !== opacity) el.style.opacity = opacity;
    if (opacity === '0') return;
    const s = this.toScreen(x, y);
    el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`;
  }
}
