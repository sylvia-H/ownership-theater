import { useEffect, useState } from 'preact/hooks';
import type { Page } from '../core/page.ts';
import { pages } from '../pages/index.ts';
import { PageView } from './PageView.tsx';
import './top.css';

type HomeView = typeof import('./Home.tsx').Home;

interface Route {
  slug: string;
  t: number;
}

// `#/move?t=1.5`：slug 選頁，t 是初始時間（截圖驗收用）。`#/`、空的、不認得的 slug 都是首頁。
function parseHash(): Route {
  const raw = location.hash.replace(/^#\/?/, '');
  const [slug = '', query = ''] = raw.split('?');
  const t = Number(new URLSearchParams(query).get('t') ?? '0');
  return { slug, t: Number.isFinite(t) ? t : 0 };
}

export function App() {
  const [route, setRoute] = useState(parseHash);
  const [loaded, setLoaded] = useState<{ slug: string; page: Page } | null>(null);
  const [failed, setFailed] = useState(false);
  const [Home, setHome] = useState<HomeView | null>(null);

  const index = pages.findIndex((p) => p.slug === route.slug);
  const entry = index >= 0 ? pages[index] : undefined;
  const isHome = !entry;

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
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

  const prev = pages[index - 1];
  const next = pages[index + 1];
  const ready = loaded && entry && loaded.slug === entry.slug ? loaded.page : null;

  return (
    <div class={'shell' + (isHome ? ' is-home' : '')}>
      <header class="top">
        <a class="brand" href="#/" aria-current={isHome ? 'page' : undefined}>
          所有權劇場
        </a>
        {!isHome && (
          <nav class="pager" aria-label="頁面">
            <PagerLink slug={prev?.slug} label="上一頁" glyph="‹" />
            <span class="pager-count">
              {index + 1}／{pages.length}
            </span>
            <PagerLink slug={next?.slug} label="下一頁" glyph="›" />
          </nav>
        )}
      </header>
      {isHome && Home ? (
        <Home />
      ) : ready ? (
        <PageView key={ready.slug} page={ready} initialT={route.t} />
      ) : (
        <p class="placeholder" role="status">
          {failed ? '這一頁載入失敗，請重新整理再試一次。' : '載入中…'}
        </p>
      )}
    </div>
  );
}

function PagerLink({ slug, label, glyph }: { slug: string | undefined; label: string; glyph: string }) {
  return slug ? (
    <a class="pager-link" href={`#/${slug}`} aria-label={label}>
      {glyph}
    </a>
  ) : (
    <span class="pager-link is-disabled" role="link" aria-label={label} aria-disabled="true">
      {glyph}
    </span>
  );
}
