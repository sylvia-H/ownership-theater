import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { buildTimeline } from '../core/timeline.ts';
import { pages } from '../pages/index.ts';
import { Stage } from '../scene/stage.ts';
import { createClock, prefersReducedMotion } from './clock.ts';
import { INTRO_DELAY_MS, INTRO_MS, INTRO_TITLE_AT, introTrace } from './intro.ts';
import { sections } from './sections.ts';
import { createStore } from './store.ts';
import './home.css';

const INTRO_END = introTrace.steps.length;

// 這次文件載入已經播過開場。模組只在文件載入時初始化一次，所以重新整理、開新分頁都會重置；
// 站內切頁再回首頁時模組還在，就不重播。
let introPlayed = false;

const INDEX_ID = 'home-index';

const captionIndex = (t: number) => (t <= 1 ? 0 : 1);

export function Home() {
  const firstSlug = pages[0]?.slug ?? 'move';

  return (
    <main class="home">
      <Intro firstSlug={firstSlug} />
      <div class="home-body">
        <Explain />
        <Index />
      </div>
    </main>
  );
}

// ── 開場 ─────────────────────────────────

type Phase = 'waiting' | 'playing' | 'done';

function Intro({ firstSlug }: { firstSlug: string }) {
  const tl = useMemo(() => buildTimeline(introTrace), []);
  const autoplay = useMemo(() => !prefersReducedMotion() && !introPlayed, []);
  const store = useMemo(() => createStore(autoplay ? 0 : INTRO_END), [autoplay]);
  const clock = useMemo(() => createClock(store), [store]);

  const [phase, setPhase] = useState<Phase>(autoplay ? 'waiting' : 'done');
  const [titleIn, setTitleIn] = useState(!autoplay);
  // 沒播開場就進來的（看過了、減少動態效果）標題直接出現，不做淡入
  const [instant, setInstant] = useState(!autoplay);
  const [cap, setCap] = useState(() => captionIndex(store.get()));
  const [flat, setFlat] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const startTimer = useRef(0);

  const play = () => {
    setPhase('playing');
    clock.to(INTRO_END, INTRO_MS, () => setPhase('done'));
  };

  const skip = () => {
    clearTimeout(startTimer.current);
    clock.cancel();
    store.set(INTRO_END);
    setTitleIn(true);
    setPhase('done');
  };

  const replay = () => {
    clock.cancel();
    store.set(0);
    play();
  };

  // 場景：只用 Stage 的公開 API。WebGL 不可用時改成純文字的標題區。
  useEffect(() => {
    const canvas = canvasRef.current;
    const labels = labelsRef.current;
    if (!canvas || !labels) return;
    let stage: Stage;
    try {
      stage = new Stage(canvas, labels, {
        onHover(id) {
          stage.setHighlight(id ? new Set([id]) : null);
        },
        onBreak() {},
      });
    } catch {
      clearTimeout(startTimer.current);
      clock.cancel();
      setFlat(true);
      setInstant(true);
      setTitleIn(true);
      setPhase('done');
      return;
    }
    stage.setTimeline(tl, null);
    stage.setT(store.get());
    const off = store.subscribe((t) => stage.setT(t));
    return () => {
      off();
      stage.dispose();
    };
  }, [tl, store, clock]);

  // t → 字幕與標題
  useEffect(
    () =>
      store.subscribe((t) => {
        setCap(captionIndex(t));
        if (t >= INTRO_END * INTRO_TITLE_AT) setTitleIn(true);
      }),
    [store],
  );

  // 自動播一次
  useEffect(() => {
    if (autoplay) {
      introPlayed = true;
      startTimer.current = window.setTimeout(play, INTRO_DELAY_MS);
    }
    return () => {
      clearTimeout(startTimer.current);
      clock.cancel();
    };
  }, [autoplay, clock]);

  // 播放中按任意鍵略過
  useEffect(() => {
    if (phase === 'done') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;
      skip();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [phase]);

  const step = introTrace.steps[cap];
  const canReplay = phase === 'done' && !flat && !prefersReducedMotion();

  return (
    <section
      class={'home-hero' + (flat ? ' is-flat' : '')}
      aria-labelledby="home-title"
      onPointerDown={phase === 'done' ? undefined : skip}
    >
      {!flat && (
        <div class="home-stage">
          <div class="home-view">
            <canvas ref={canvasRef} aria-hidden="true" />
            <div class="labels" ref={labelsRef} aria-hidden="true" />
          </div>
        </div>
      )}

      <div class="home-headline">
        <div class={'home-headline-in' + (titleIn ? ' is-in' : '') + (instant ? ' is-instant' : '')}>
          <h1 id="home-title">所有權劇場</h1>
          <p class="home-lede">同一行程式，值在 JS 與 Rust 的命運不一樣。</p>
          <p class="home-actions">
            <a class="home-cta" href={`#/${firstSlug}`}>
              從第一齣開始
            </a>
            <button
              type="button"
              class="home-more"
              onClick={() => {
                const target = document.getElementById(INDEX_ID);
                target?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
                target?.focus({ preventScroll: true });
              }}
            >
              看全部場次
            </button>
          </p>
        </div>
      </div>

      {!flat && step && (
        <div class="home-caps">
          <p class="home-cap home-cap-js">
            <span class="home-cap-tag">JS</span>
            {step.caption.js}
          </p>
          <p class="home-cap home-cap-rust">
            <span class="home-cap-tag">Rust</span>
            {step.caption.rust}
          </p>
          <button
            type="button"
            class={'btn home-replay' + (canReplay ? ' is-in' : '')}
            onClick={replay}
            disabled={!canReplay}
          >
            重播
          </button>
        </div>
      )}
    </section>
  );
}

// ── 三段說明 ───────────────────────────────

function Explain() {
  return (
    <div class="home-explain">
      <section class="home-row" aria-labelledby="home-why">
        <h2 id="home-why">為什麼叫「劇場」</h2>
        <div class="home-text">
          <p>每一頁是一齣短劇，演員是「值」。舞台分成左右兩半，同一段程式在 JS 與 Rust 各演一次。</p>
          <p>
            拖時間軸可以前進、後退，看值在每一步的下場。每頁還有一個「弄壞它」的動作，看 Rust
            的編譯器怎麼把它擋下來。
          </p>
          <p>「所有權」是這齣戲的主題：在 Rust，每個值同一時間只有一個擁有者。</p>
        </div>
      </section>

      <section class="home-row" aria-labelledby="home-read">
        <h2 id="home-read">兩個世界怎麼讀</h2>
        <div class="home-legend">
          <div class="home-world home-world-js">
            <h3>JS 世界</h3>
            <ul>
              <li>
                <i class="g g-orb" aria-hidden="true" />
                值是漂在空中的光球。
              </li>
              <li>
                <i class="g g-link" aria-hidden="true" />
                變數是連到它的線，很多條線可以連同一顆。
              </li>
              <li>
                <i class="g g-stray" aria-hidden="true" />
                沒有線連著的球繼續漂，等 GC 經過才收走。
              </li>
            </ul>
          </div>
          <div class="home-world home-world-rust">
            <h3>Rust 世界</h3>
            <ul>
              <li>
                <i class="g g-held" aria-hidden="true" />
                值是被夾具握著的晶體，一個值只被一隻夾具握著。
              </li>
              <li>
                <i class="g g-husk" aria-hidden="true" />
                指定是整顆搬走，原本的夾具變成空殼。
              </li>
              <li>
                <i class="g g-shards" aria-hidden="true" />
                離開範圍的那一刻，值當場碎掉。
              </li>
              <li>
                <i class="g g-beam" aria-hidden="true" />
                借用是一道光束：可以有很多道只讀的，或唯一一道可改的。
              </li>
              <li>
                <i class="g g-field" aria-hidden="true" />
                違規會被力場彈開，上面是 rustc 的錯誤訊息原文。
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section class="home-row" aria-labelledby="home-core">
        <h2 id="home-core">Rust 的核心精神</h2>
        <div class="home-text">
          <ol class="home-rules">
            <li>每個值只有一個擁有者。</li>
            <li>可以借，但規則在編譯期就檢查：同一時間，要嘛很多人讀，要嘛只有一個人改。</li>
            <li>擁有者離開範圍，值立刻釋放。所以不需要 GC，也不會有指向已釋放記憶體的參考。</li>
          </ol>
          <p class="home-point">
            兩邊的差別不是「有沒有」，是「預設」：JS 預設共享、誰都能改；Rust 預設獨占，要共享、要可改都得明講。
          </p>
        </div>
      </section>
    </div>
  );
}

// ── 分區索引 ───────────────────────────────

const titleOf = new Map(pages.map((p) => [p.slug, p.title]));

/** 每一區的第一齣是全站第幾齣（1 起算） */
const firstNo = sections.map((_, i) => sections.slice(0, i).reduce((n, s) => n + s.slugs.length, 0) + 1);
const totalCount = sections.reduce((n, s) => n + s.slugs.length, 0);

const two = (n: number) => String(n).padStart(2, '0');

function Index() {
  const [sel, setSel] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const section = sections[sel] ?? sections[0];

  const select = (i: number) => {
    const n = sections.length;
    const next = ((i % n) + n) % n;
    setSel(next);
    tabRefs.current[next]?.focus();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') select(sel + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') select(sel - 1);
    else if (e.key === 'Home') select(0);
    else if (e.key === 'End') select(sections.length - 1);
    else return;
    e.preventDefault();
  };

  const random = () => {
    const pick = pages[Math.floor(Math.random() * pages.length)];
    if (pick) location.hash = `#/${pick.slug}`;
  };

  if (!section) return null;
  const base = firstNo[sel] ?? 1;

  return (
    <section class="home-index" aria-labelledby={INDEX_ID}>
      <div class="home-index-head">
        <h2 id={INDEX_ID} tabIndex={-1}>
          全部場次
        </h2>
        <p class="home-index-note">
          共 {totalCount} 齣，照 Rust Book 的順序排；已開放 {pages.length} 齣。
        </p>
      </div>

      <div class="home-tabbar">
        <div class="home-tabs" role="tablist" aria-label="分區" onKeyDown={onKey}>
          {sections.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              id={`home-tab-${s.id}`}
              class="home-tab"
              aria-selected={i === sel}
              aria-controls="home-panel"
              tabIndex={i === sel ? 0 : -1}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              onClick={() => setSel(i)}
            >
              {s.name}
              <span class="home-tab-count">{s.slugs.length}</span>
            </button>
          ))}
        </div>
        <button type="button" class="btn home-random" onClick={random} disabled={pages.length === 0}>
          隨機看一齣
        </button>
      </div>

      <div class="home-panel" role="tabpanel" id="home-panel" aria-labelledby={`home-tab-${section.id}`}>
        <p class="home-panel-sub">{section.sub}</p>
        <ul class="home-cards">
          {section.slugs.map((slug, i) => {
            const title = titleOf.get(slug);
            const no = two(base + i);
            return (
              <li key={slug}>
                {title !== undefined ? (
                  <a class="home-card" href={`#/${slug}`}>
                    <span class="home-card-no">{no}</span>
                    <span class="home-card-title">{title}</span>
                  </a>
                ) : (
                  <div class="home-card is-pending">
                    <span class="home-card-no">{no}</span>
                    <span class="home-card-title">{slug}</span>
                    <span class="home-card-state">製作中</span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
