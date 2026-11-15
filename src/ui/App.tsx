import { useEffect, useState } from 'preact/hooks';
import type { Page } from '../core/page.ts';
import { problems } from '../lc/index.ts';
import type { LcProblem } from '../lc/types.ts';
import { pages } from '../pages/index.ts';
import { PageView } from './PageView.tsx';
import { stripInlineCode } from './inline.ts';
import { setLang, siteName, syncLangFromHash, type Lang } from './lang.ts';
import { isSoundOn, setSoundOn } from './sound.ts';
import { STRINGS } from './strings.ts';
import { useLang } from './useLang.ts';
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
// `#/`、空的、不認得的 slug 都是首頁。`lang=en`／`lang=zh` 指定介面語言，由 lang.ts 讀。
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
  const [sound, setSound] = useState(isSoundOn);
  const lang = useLang();
  const S = STRINGS[lang];

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
      syncLangFromHash();
      setRoute(parseHash());
    };
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  // 首頁的內容另外載入，不進各頁的首屏
  useEffect(() => {
    if (!isHome || Home) return;
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

  // 分頁標題跟著頁面與語言走；內容還在載入時先維持上一個標題
  const pageTitle = ready ? ((lang === 'en' ? ready.en?.title : undefined) ?? ready.title) : null;
  const lcTitle = lcReady ? lcReady.problem.title : null;
  useEffect(() => {
    if (isHome) document.title = siteName(lang);
    else if (pageTitle !== null) document.title = S.pageTitle(stripInlineCode(pageTitle));
    else if (lcTitle !== null) document.title = S.lcTitle(lcTitle);
  }, [lang, isHome, pageTitle, lcTitle]);

  return (
    <div class={'shell' + (isHome ? ' is-home' : '') + (lcEntry ? ' is-lc' : '')}>
      <header class="top">
        <a class="brand" href="#/" aria-current={isHome ? 'page' : undefined}>
          {siteName(lang)}
        </a>
        {/* 只有劇場頁有聲音；按鈕和頁碼的按鈕一樣高，頁首不會跳動 */}
        {entry && (
          <button
            type="button"
            class={'btn sound-btn' + (sound ? ' is-on' : '')}
            aria-pressed={sound}
            aria-label={sound ? S.soundOn : S.soundOff}
            title={sound ? S.soundOn : S.soundOff}
            onClick={() => {
              setSoundOn(!sound);
              setSound(!sound);
            }}
          >
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <path d="M2.5 6h2.2L8 3.2v9.6L4.7 10H2.5z" />
              <path d={sound ? 'M10.4 5.8a3 3 0 0 1 0 4.4M12.2 4a5.6 5.6 0 0 1 0 8' : 'M10.6 6.2l3.6 3.6M14.2 6.2l-3.6 3.6'} />
            </svg>
          </button>
        )}
        {entry && (
          <nav class="pager" aria-label={S.pagerLabel}>
            <PagerLink href={prev && `#/${prev.slug}`} label={S.prevPage} glyph="‹" />
            <span class="pager-count">
              {S.pageOf(index + 1, pages.length)}
            </span>
            <PagerLink href={next && `#/${next.slug}`} label={S.nextPage} glyph="›" />
          </nav>
        )}
        {lcEntry && (
          <nav class="pager" aria-label={S.lcPagerLabel}>
            <PagerLink href={lcPrev && `#/${LC_PREFIX}${lcPrev.slug}`} label={S.prevProblem} glyph="‹" />
            <span class="pager-count">
              <span class="pager-area">LeetCode</span>
              {S.pageOf(lcIndex + 1, problems.length)}
            </span>
            <PagerLink href={lcNext && `#/${LC_PREFIX}${lcNext.slug}`} label={S.nextProblem} glyph="›" />
          </nav>
        )}
        <LangSwitch lang={lang} label={S.language} />
      </header>
      {isHome && Home ? (
        <Home tab={route.tab} />
      ) : ready ? (
        <PageView key={ready.slug} page={ready} initialT={route.t} />
      ) : lcReady ? (
        <lcReady.View key={lcReady.slug} problem={lcReady.problem} />
      ) : (
        <p class="placeholder" role="status">
          {failed ? S.loadFailed : S.loading}
        </p>
      )}
    </div>
  );
}

/** 語言切換：兩段都看得到，目前的那段加強。兩個名稱各用自己的語言寫，不跟著介面語言換 */
function LangSwitch({ lang, label }: { lang: Lang; label: string }) {
  return (
    <div class="lang" role="group" aria-label={label}>
      <button type="button" class="lang-opt" lang="zh-Hant" aria-pressed={lang === 'zh'} onClick={() => setLang('zh')}>
        中文
      </button>
      <span class="lang-sep" aria-hidden="true">
        ｜
      </span>
      <button type="button" class="lang-opt" lang="en" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>
        EN
      </button>
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
