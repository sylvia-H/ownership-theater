import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { buildTimeline } from '../core/timeline.ts';
import { problems } from '../lc/index.ts';
import { TEASERS_EN } from '../lc/teasers.en.ts';
import { pages } from '../pages/index.ts';
import { TITLES_EN } from '../pages/titles.en.ts';
import { Stage } from '../scene/stage.ts';
import { createClock, prefersReducedMotion } from './clock.ts';
import { Rich } from './Rich.tsx';
import { HOME_EN, type HomeText } from './home.en.ts';
import { HOME_ZH } from './home.zh.ts';
import { buildIntroTrace, INTRO_DELAY_MS, INTRO_MS, INTRO_STEPS, INTRO_TITLE_AT } from './intro.ts';
import type { Lang } from './lang.ts';
import { lcSection, sections } from './sections.ts';
import { createStore } from './store.ts';
import { STRINGS } from './strings.ts';
import { useLang } from './useLang.ts';
import './home.css';

const INTRO_END = INTRO_STEPS;

// 這次文件載入已經播過開場。模組只在文件載入時初始化一次，所以重新整理、開新分頁都會重置；
// 站內切頁再回首頁時模組還在，就不重播。
let introPlayed = false;

const INDEX_ID = 'home-index';

const captionIndex = (t: number) => (t <= 1 ? 0 : 1);

export function Home({ tab = '' }: { tab?: string }) {
  const firstSlug = pages[0]?.slug ?? 'move';
  const lang = useLang();
  const T = lang === 'en' ? HOME_EN : HOME_ZH;

  return (
    <main class="home">
      <Intro firstSlug={firstSlug} T={T} lang={lang} />
      <div class="home-body">
        <Explain T={T} />
        <Index tab={tab} T={T} lang={lang} />
      </div>
    </main>
  );
}

// ── 開場 ─────────────────────────────────

type Phase = 'waiting' | 'playing' | 'done';

function Intro({ firstSlug, T, lang }: { firstSlug: string; T: HomeText; lang: Lang }) {
  // 開場的軌跡依語言產生（舞台上的標籤與字幕）。換語言會重建時間軸與場景，但 store 不重建，t 留在原地。
  const introTrace = useMemo(() => buildIntroTrace(T.intro), [T]);
  const tl = useMemo(() => buildTimeline(introTrace), [introTrace]);
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
    const S = STRINGS[lang];
    stage.setTexts({ jsWorld: S.jsWorld, rustWorld: S.rustWorld, count: S.count });
    stage.setTimeline(tl, null);
    stage.setT(store.get());
    const off = store.subscribe((t) => stage.setT(t));
    return () => {
      off();
      stage.dispose();
    };
  }, [tl, store, clock, lang]);

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
          <h1 id="home-title">{T.hero.title}</h1>
          <p class="home-lede">{T.hero.lede}</p>
          <p class="home-actions">
            <a class="home-cta" href={`#/${firstSlug}`}>
              {T.hero.cta}
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
              {T.hero.more}
            </button>
          </p>
        </div>
      </div>

      {!flat && step && (
        <div class="home-caps">
          <p class="home-cap home-cap-js">
            <span class="home-cap-tag">JS</span>
            <Rich text={step.caption.js} />
          </p>
          <p class="home-cap home-cap-rust">
            <span class="home-cap-tag">Rust</span>
            <Rich text={step.caption.rust} />
          </p>
          <button
            type="button"
            class={'btn home-replay' + (canReplay ? ' is-in' : '')}
            onClick={replay}
            disabled={!canReplay}
          >
            {T.hero.replay}
          </button>
        </div>
      )}
    </section>
  );
}

// ── 三段說明 ───────────────────────────────

function Explain({ T }: { T: HomeText }) {
  return (
    <div class="home-explain">
      <section class="home-row" aria-labelledby="home-why">
        <h2 id="home-why">{T.why.heading}</h2>
        <div class="home-text">
          {T.why.paragraphs.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </div>
      </section>

      <section class="home-row" aria-labelledby="home-read">
        <h2 id="home-read">{T.read.heading}</h2>
        <div class="home-legend">
          <div class="home-world home-world-js">
            <h3>{T.read.js.heading}</h3>
            <ul>
              <li>
                <i class="g g-orb" aria-hidden="true" />
                {T.read.js.items.orb}
              </li>
              <li>
                <i class="g g-link" aria-hidden="true" />
                {T.read.js.items.link}
              </li>
              <li>
                <i class="g g-stray" aria-hidden="true" />
                {T.read.js.items.stray}
              </li>
            </ul>
          </div>
          <div class="home-world home-world-rust">
            <h3>{T.read.rust.heading}</h3>
            <ul>
              <li>
                <i class="g g-held" aria-hidden="true" />
                {T.read.rust.items.held}
              </li>
              <li>
                <i class="g g-husk" aria-hidden="true" />
                {T.read.rust.items.husk}
              </li>
              <li>
                <i class="g g-shards" aria-hidden="true" />
                {T.read.rust.items.shards}
              </li>
              <li>
                <i class="g g-beam" aria-hidden="true" />
                {T.read.rust.items.beam}
              </li>
              <li>
                <i class="g g-field" aria-hidden="true" />
                {T.read.rust.items.field}
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section class="home-row" aria-labelledby="home-core">
        <h2 id="home-core">{T.core.heading}</h2>
        <div class="home-text">
          <ol class="home-rules">
            {T.core.rules.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ol>
          <p class="home-point">{T.core.point}</p>
        </div>
      </section>
    </div>
  );
}

// ── 分區索引 ───────────────────────────────

/** 首頁不先載入各頁，標題取自註冊表（中文）與 titles.en.ts（英文） */
const titleOf = (slug: string, lang: Lang): string | undefined => {
  const zh = pages.find((p) => p.slug === slug)?.title;
  return zh === undefined ? undefined : lang === 'en' ? (TITLES_EN[slug] ?? zh) : zh;
};

/** 每一區的第一齣是全站第幾齣（1 起算） */
const firstNo = sections.map((_, i) => sections.slice(0, i).reduce((n, s) => n + s.slugs.length, 0) + 1);
const totalCount = sections.reduce((n, s) => n + s.slugs.length, 0);

const two = (n: number) => String(n).padStart(2, '0');

/** 頁籤：17 齣的各分區，最後是 LeetCode 對照 */
const tabs = [
  ...sections.map((s) => ({ id: s.id, count: s.slugs.length })),
  { id: lcSection.id, count: problems.length },
];

/** tab 是網址帶進來的頁籤 id（`#/?tab=lc`，從對照頁回來時用）：先選那個頁籤，並捲到索引 */
function Index({ tab, T, lang }: { tab: string; T: HomeText; lang: Lang }) {
  const [sel, setSel] = useState(() => Math.max(0, tabs.findIndex((t) => t.id === tab)));
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const headRef = useRef<HTMLHeadingElement>(null);
  const section = sections[sel];
  const current = tabs[sel] ?? tabs[0];

  useEffect(() => {
    const i = tabs.findIndex((t) => t.id === tab);
    if (i < 0) return;
    setSel(i);
    headRef.current?.scrollIntoView({ block: 'start' });
  }, [tab]);

  const select = (i: number) => {
    const n = tabs.length;
    const next = ((i % n) + n) % n;
    setSel(next);
    tabRefs.current[next]?.focus();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') select(sel + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') select(sel - 1);
    else if (e.key === 'Home') select(0);
    else if (e.key === 'End') select(tabs.length - 1);
    else return;
    e.preventDefault();
  };

  // 只從 17 齣裡挑，不含 LeetCode 對照
  const random = () => {
    const pick = pages[Math.floor(Math.random() * pages.length)];
    if (pick) location.hash = `#/${pick.slug}`;
  };

  if (!current) return null;
  const base = firstNo[sel] ?? 1;

  return (
    <section class="home-index" aria-labelledby={INDEX_ID}>
      <div class="home-index-head">
        <h2 id={INDEX_ID} tabIndex={-1} ref={headRef}>
          {T.index.heading}
        </h2>
        <p class="home-index-note">
          {T.index.note(totalCount, pages.length)}
          {problems.length > 0 && T.index.noteJoin + T.index.noteLc(problems.length)}
        </p>
      </div>

      <div class="home-tabbar">
        <div class="home-tabs" role="tablist" aria-label={T.index.tabsLabel} onKeyDown={onKey}>
          {tabs.map((t, i) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`home-tab-${t.id}`}
              class="home-tab"
              aria-selected={i === sel}
              aria-controls="home-panel"
              tabIndex={i === sel ? 0 : -1}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              onClick={() => setSel(i)}
            >
              {T.sections[t.id].name}
              {t.count > 0 && <span class="home-tab-count">{t.count}</span>}
            </button>
          ))}
        </div>
        <button type="button" class="btn home-random" onClick={random} disabled={pages.length === 0}>
          {T.index.random}
        </button>
      </div>

      <div class="home-panel" role="tabpanel" id="home-panel" aria-labelledby={`home-tab-${current.id}`}>
        {section ? (
          <>
            <p class="home-panel-sub">{T.sections[section.id].sub}</p>
            <ul class="home-cards">
              {section.slugs.map((slug, i) => {
                const title = titleOf(slug, lang);
                const no = two(base + i);
                return (
                  <li key={slug}>
                    {title !== undefined ? (
                      <a class="home-card" href={`#/${slug}`}>
                        <span class="home-card-no">{no}</span>
                        <span class="home-card-title">
                          <Rich text={title} />
                        </span>
                      </a>
                    ) : (
                      <div class="home-card is-pending">
                        <span class="home-card-no">{no}</span>
                        <span class="home-card-title">{slug}</span>
                        <span class="home-card-state">{T.index.pending}</span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <>
            <p class="home-panel-sub">{T.sections.lc.sub}</p>
            {problems.length > 0 ? (
              <ul class="home-cards">
                {problems.map((p) => (
                  <li key={p.slug}>
                    <a class="home-card" href={`#/lc/${p.slug}`}>
                      <span class="home-card-no">#{p.number}</span>
                      <span class="home-card-title">{p.title}</span>
                      <span class="home-card-teaser">
                        <Rich text={lang === 'en' ? (TEASERS_EN[p.slug] ?? p.teaser) : p.teaser} />
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p class="home-empty">{T.index.pending}</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
