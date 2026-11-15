import { useEffect, useState } from 'preact/hooks';
import type { Page } from '../core/page.ts';
import { problems } from '../lc/index.ts';
import type { LcProblem } from '../lc/types.ts';
import { pages } from '../pages/index.ts';
import { PageView } from './PageView.tsx';
import './top.css';

type HomeView = typeof import('./Home.tsx').Home;
type LcViewType = typeof import('./LcView.tsx').LcView;

interface Route {
  slug: string;
  t: number;
  /** 首頁要先打開哪個分區頁籤（`#/?tab=lc`） */
  tab: string;
}

const LC_PREFIX = 'lc/';

// `#/move?t=1.5`：slug 選頁，t 是初始時間（截圖驗收用）。`#/lc/<slug>` 是 LeetCode 對照頁。
// `#/`、空的、不認得的 slug 都是首頁。
function parseHash(): Route {
  const raw = location.hash.replace(/^#\/?/, '');
  const [slug = '', query = ''] = raw.split('?');
  const params = new URLSearchParams(query);
  const t = Number(params.get('t') ?? '0');
  return { slug, t: Number.isFinite(t) ? t : 0, tab: params.get('tab') ?? '' };
}

export function App() {
  const [route, setRoute] = useState(parseHash);
  const [loaded, setLoaded] = useState<{ slug: string; page: Page } | null>(null);
  const [lc, setLc] = useState<{ slug: string; problem: LcProblem; View: LcViewType } | null>(null);
  const [failed, setFailed] = useState(false);
  const [Home, setHome] = useState<HomeView | null>(null);

  const index = pages.findIndex((p) => p.slug === route.slug);
  const entry = index >= 0 ? pages[index] : undefined;

  const lcIndex = route.slug.startsWith(LC_PREFIX)
    ? problems.findIndex((p) => p.slug === route.slug.slice(LC_PREFIX.length))
    : -1;
  const lcEntry = lcIndex >= 0 ? problems[lcIndex] : undefined;

  const isHome = !entry && !lcEntry;

  useEffect(() => {
    const onHash = () => {
      // 對照頁與首頁是整頁捲動的：換頁時回到頂端
      scrollTo(0, 0);
      setRoute(parseHash());
    };
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  // 首頁的內容另外載入，不進各頁的首屏
  useEffect(() => {
    if (!isHome) return;
    document.title = '所有權劇場';
    if (Home) return;
    let stale = false;
    setFailed(false);
    import('./Home.tsx').then(
      (m) => {
        if (!stale) setHome(() => m.Home);
      },
      () => {
        if (!stale) setFailed(true);
      },
    );
    return () => {
      stale = true;
    };
  }, [isHome, Home]);

  useEffect(() => {
    if (!entry) return;
    let stale = false;
    setFailed(false);
    entry.load().then(
      (page) => {
        if (stale) return;
        setLoaded({ slug: entry.slug, page });
        document.title = `${page.title}｜所有權劇場`;
      },
      () => {
        if (!stale) setFailed(true);
      },
    );
    return () => {
      stale = true;
    };
  }, [entry]);

  // 對照頁的畫面與題目內容都另外載入，不進首屏
  useEffect(() => {
    if (!lcEntry) return;
    let stale = false;
    setFailed(false);
    Promise.all([import('./LcView.tsx'), lcEntry.load()]).then(
      ([m, problem]) => {
        if (stale) return;
        setLc({ slug: lcEntry.slug, problem, View: m.LcView });
        document.title = `${problem.title}｜LeetCode 對照｜所有權劇場`;
      },
      () => {
        if (!stale) setFailed(true);
      },
    );
    return () => {
      stale = true;
    };
  }, [lcEntry]);

  const prev = pages[index - 1];
  const next = pages[index + 1];
  const ready = loaded && entry && loaded.slug === entry.slug ? loaded.page : null;
  const lcReady = lc && lcEntry && lc.slug === lcEntry.slug ? lc : null;
  const lcPrev = lcEntry ? problems[lcIndex - 1] : undefined;
  const lcNext = lcEntry ? problems[lcIndex + 1] : undefined;

  return (
    <div class={'shell' + (isHome ? ' is-home' : '') + (lcEntry ? ' is-lc' : '')}>
      <header class="top">
        <a class="brand" href="#/" aria-current={isHome ? 'page' : undefined}>
          所有權劇場
        </a>
        {entry && (
          <nav class="pager" aria-label="頁面">
            <PagerLink href={prev && `#/${prev.slug}`} label="上一頁" glyph="‹" />
            <span class="pager-count">
              {index + 1}／{pages.length}
            </span>
            <PagerLink href={next && `#/${next.slug}`} label="下一頁" glyph="›" />
          </nav>
        )}
        {lcEntry && (
          <nav class="pager" aria-label="LeetCode 對照的題目">
            <PagerLink href={lcPrev && `#/${LC_PREFIX}${lcPrev.slug}`} label="上一題" glyph="‹" />
            <span class="pager-count">
              <span class="pager-area">LeetCode</span>
              {lcIndex + 1}／{problems.length}
            </span>
            <PagerLink href={lcNext && `#/${LC_PREFIX}${lcNext.slug}`} label="下一題" glyph="›" />
          </nav>
        )}
      </header>
      {isHome && Home ? (
        <Home tab={route.tab} />
      ) : ready ? (
        <PageView key={ready.slug} page={ready} initialT={route.t} />
      ) : lcReady ? (
        <lcReady.View key={lcReady.slug} problem={lcReady.problem} />
      ) : (
        <p class="placeholder" role="status">
          {failed ? '這一頁載入失敗，請重新整理再試一次。' : '載入中…'}
        </p>
      )}
    </div>
  );
}

function PagerLink({ href, label, glyph }: { href: string | undefined; label: string; glyph: string }) {
  return href ? (
    <a class="pager-link" href={href} aria-label={label}>
      {glyph}
    </a>
  ) : (
    <span class="pager-link is-disabled" role="link" aria-label={label} aria-disabled="true">
      {glyph}
    </span>
  );
}
