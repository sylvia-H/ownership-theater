import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { localizePage } from '../core/localize.ts';
import type { Page } from '../core/page.ts';
import { breakRange, buildTimeline, idsForLine, linesForId, type Lang } from '../core/timeline.ts';
import { Stage } from '../scene/stage.ts';
import { CodePanel } from './CodePanel.tsx';
import { Rich } from './Rich.tsx';
import { Timeline } from './Timeline.tsx';
import { createClock, prefersReducedMotion } from './clock.ts';
import { attachSound, playBreak } from './sound.ts';
import { createStore } from './store.ts';
import { STRINGS } from './strings.ts';
import { useLang } from './useLang.ts';

const STEP_MS = 650;
const PLAY_MS = 900;
const SNAP_MS = 200;

const stepIndex = (t: number) => (t <= 0 ? -1 : Math.ceil(t) - 1);

const lineSet = (lines: (number | null)[]): ReadonlySet<number> =>
  new Set(lines.filter((l): l is number => l !== null));

export function PageView({ page, initialT }: { page: Page; initialT: number }) {
  // 軌跡與「弄壞它」的設定一律用原本那一份：時間軸、場景、音效都建在它上面，換語言時不重建，t 也就不會動。
  // 顯示給讀者的文字（標題、說明、字幕、程式碼註解）才看 view。
  const { trace, breakIt } = page;
  const lang = useLang();
  const S = STRINGS[lang];
  const view = useMemo(() => (lang === 'en' && page.en ? localizePage(page, page.en) : page), [page, lang]);
  const tl = useMemo(() => buildTimeline(trace), [trace]);
  const range = useMemo(() => (breakIt ? breakRange(tl, breakIt) : null), [tl, breakIt]);
  const total = tl.steps;

  // t 的熱路徑：場景與滑桿直接訂閱 store，Preact 只在步驟索引改變時重繪
  const store = useMemo(() => createStore(Math.min(Math.max(initialT, 0), total)), [tl]);
  const clock = useMemo(() => createClock(store), [store]);

  const [idx, setIdx] = useState(() => stepIndex(store.get()));
  const [inRange, setInRange] = useState(false);
  const [broken, setBroken] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [glFailed, setGlFailed] = useState(false);
  const [hot, setHot] = useState<{ lang: Lang; lines: ReadonlySet<number> } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const playTimer = useRef(0);

  const stop = () => {
    clock.cancel();
    clearTimeout(playTimer.current);
    setPlaying(false);
  };

  const goTo = (target: number, ms: number) => {
    stop();
    clock.to(Math.min(Math.max(target, 0), total), ms);
  };

  const prev = () => {
    const t = store.get();
    goTo(Math.ceil(t) - 1, STEP_MS);
  };
  const next = () => {
    const t = store.get();
    goTo(Math.floor(t) + 1, STEP_MS);
  };

  const playOn = () => {
    const t = store.get();
    if (t >= total) {
      setPlaying(false);
      return;
    }
    const target = Math.min(Math.floor(t) + 1, total);
    if (prefersReducedMotion()) {
      // 不做補間，但仍一步一步走，否則「播放」會直接跳到結尾
      playTimer.current = window.setTimeout(() => {
        store.set(target);
        playOn();
      }, PLAY_MS);
    } else {
      clock.to(target, PLAY_MS * (target - t), playOn);
    }
  };

  const togglePlay = () => {
    if (playing) {
      stop();
      return;
    }
    stop();
    if (store.get() >= total) store.set(0);
    setPlaying(true);
    playOn();
  };

  // store → 滑桿與步驟狀態
  useEffect(() => {
    const apply = (t: number) => {
      const slider = sliderRef.current;
      if (slider && Number(slider.value) !== t) slider.value = String(t);
      setIdx(stepIndex(t));
      const within = !!range && t >= range.from && t <= range.to;
      setInRange(within);
      if (!within) setBroken(false);
    };
    apply(store.get());
    return store.subscribe(apply);
  }, [store, range]);

  // 音效：直接訂閱 store，不經過 Preact
  useEffect(() => attachSound(store, trace, tl), [store, trace, tl]);

  // 場景
  useEffect(() => {
    const canvas = canvasRef.current;
    const labels = labelsRef.current;
    if (!canvas || !labels) return;
    let stage: Stage;
    try {
      stage = new Stage(canvas, labels, {
        onHover(id) {
          if (id) {
            const hit = linesForId(tl, trace, id);
            setHot({ lang: hit.lang, lines: new Set(hit.lines) });
            stageRef.current?.setHighlight(new Set([id]));
          } else {
            setHot(null);
            stageRef.current?.setHighlight(null);
          }
        },
        onBreak() {
          setBroken(true);
          playBreak();
        },
      });
    } catch {
      setGlFailed(true);
      return;
    }
    stageRef.current = stage;
    stage.setTimeline(tl, breakIt);
    stage.setT(store.get());
    const off = store.subscribe((t) => stage.setT(t));
    return () => {
      off();
      stage.dispose();
      stageRef.current = null;
    };
  }, [tl, trace, breakIt, store]);

  // 舞台上由程式產生的文字跟著語言走（排在建立場景的 effect 之後，場景重建時也會再設一次）
  useEffect(() => {
    stageRef.current?.setTexts({
      jsWorld: S.jsWorld,
      rustWorld: S.rustWorld,
      count: S.count,
      labels: lang === 'en' ? page.en?.labels : undefined,
    });
  }, [lang, page, tl, trace, breakIt, store]);

  // 鍵盤 ← →
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const el = e.target instanceof HTMLElement ? e.target : null;
      const onSlider = el === sliderRef.current;
      if (!onSlider && el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      e.preventDefault();
      if (e.key === 'ArrowLeft') prev();
      else next();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  useEffect(
    () => () => {
      clock.cancel();
      clearTimeout(playTimer.current);
    },
    [clock],
  );

  const step = idx >= 0 ? view.trace.steps[idx] : undefined;
  const pickable = useMemo(
    () => ({
      rust: lineSet(trace.steps.map((s) => s.rustLine)),
      ts: lineSet(trace.steps.map((s) => s.tsLine)),
    }),
    [trace],
  );

  const panel = (lang: Lang, title: string, code: string) => (
    <CodePanel
      lang={lang}
      title={title}
      code={code}
      current={step ? (lang === 'rust' ? step.rustLine : step.tsLine) : null}
      hot={hot?.lang === lang ? hot.lines : null}
      pickable={pickable[lang]}
      onEnter={(line) => stageRef.current?.setHighlight(new Set(idsForLine(tl, trace, lang, line)))}
      onLeave={() => stageRef.current?.setHighlight(null)}
      onPick={(line) => {
        const i = trace.steps.findIndex((s) => (lang === 'rust' ? s.rustLine : s.tsLine) === line);
        if (i >= 0) goTo(i + 1, STEP_MS);
      }}
    />
  );

  const rustcMessage = page.verified.files['broken.rs']?.message ?? '';

  return (
    <main class="page">
      <div class="side">
        <header class="prose">
          <p class="kicker">{view.kicker}</p>
          <h1>
            <Rich text={view.title} />
          </h1>
          {view.lead.map((text, i) => (
            <p key={i}>
              <Rich text={text} />
            </p>
          ))}
        </header>
        <div class="codes">
          {panel('ts', 'TypeScript', view.ts)}
          {panel('rust', 'Rust', view.rust)}
        </div>
        <figure class="book">
          <blockquote lang="en">
            {page.book.quote.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </blockquote>
          <figcaption>
            <a href={page.book.url} target="_blank" rel="noreferrer">
              {page.book.cite}
            </a>
            {S.bookZh && (
              <a href={page.book.urlZh} target="_blank" rel="noreferrer">
                {S.bookZh}
              </a>
            )}
          </figcaption>
        </figure>
      </div>

      <div class="main">
        <section class="stage" aria-label={S.stageLabel}>
          <div class="stage-view">
            <canvas ref={canvasRef} aria-hidden="true" />
            <div class="labels" ref={labelsRef} aria-hidden="true" />
          </div>
          {glFailed && (
            <p class="stage-fallback">{S.webglFailed}</p>
          )}
          {breakIt && broken && (
            <div class="rustc" role="alert">
              <div class="rustc-head">
                <h2>
                  {breakIt.expect === 'panic'
                    ? S.rustcPanic(page.verified.rustc)
                    : S.rustcSays(page.verified.rustc)}
                </h2>
                <button type="button" class="btn rustc-close" onClick={() => setBroken(false)} aria-label={S.close}>
                  ×
                </button>
              </div>
              <pre tabIndex={0}>{rustcMessage}</pre>
              <p class="rustc-plain">
                <Rich text={view.breakIt?.plain ?? breakIt.plain} />
              </p>
            </div>
          )}
        </section>

        {/* 放在場景外面：窄螢幕時排在場景正下方，桌面用絕對定位疊回場景右上角 */}
        {breakIt && range && !glFailed && (
          <div class="break">
            <button
              type="button"
              class={'break-btn' + (inRange ? ' is-armed' : '')}
              onClick={() => {
                if (inRange) stageRef.current?.tryBreak();
                else goTo(range.from, STEP_MS);
              }}
            >
              {/* 包一層：按鈕是 flex，行內程式碼不能各自變成一個 flex 項目 */}
              <span>
                <Rich text={view.breakIt?.hint ?? breakIt.hint} />
              </span>
            </button>
            {!inRange && <p class="break-note">{S.goToStepFirst(range.from)}</p>}
          </div>
        )}

        <Timeline
          steps={total}
          idx={idx}
          step={step}
          playing={playing}
          sliderRef={sliderRef}
          onScrub={(t) => {
            stop();
            store.set(t);
          }}
          onRelease={() => goTo(Math.round(store.get()), SNAP_MS)}
          onPrev={prev}
          onNext={next}
          onTogglePlay={togglePlay}
        />
      </div>
    </main>
  );
}
