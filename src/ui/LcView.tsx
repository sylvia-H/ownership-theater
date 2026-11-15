import { useMemo, useState } from 'preact/hooks';
import type { Lang } from '../core/timeline.ts';
import { problems } from '../lc/index.ts';
import { LC_TAGS, type LcEntry, type LcProblem, type LcTag } from '../lc/types.ts';
import { pages } from '../pages/index.ts';
import { tokenize, type Token } from './highlight.ts';
import './lc.css';

const TAG_KEYS = Object.keys(LC_TAGS) as LcTag[];

const LEGEND_IDLE = '灰色的行兩邊一對一對應；亮起來的是 Rust 多出來的。滑到類別上，只看那一類。';

interface CodeLine {
  /** 去掉開頭縮排之後的內容 */
  tokens: Token[];
  /** 開頭縮排幾格 */
  indent: number;
}

// 開頭的縮排用不斷行空白畫：一般空白後面可以折行，放不下的長行會先在縮排後面折，留下一行空的。
// 複製時再換回一般空白（onCopy）。
const NBSP = String.fromCharCode(0xa0);

function toLines(code: string, lang: Lang): CodeLine[] {
  return code
    .replace(/\r\n/g, '\n')
    .replace(/\n+$/, '')
    .split('\n')
    .map((text) => {
      const body = text.trimStart();
      return { tokens: tokenize(body, lang), indent: text.length - body.length };
    });
}

const two = (n: number) => String(n).padStart(2, '0');

export function LcView({ problem }: { problem: LcProblem }) {
  /** 圖例上滑到（或聚焦）的類別：只亮那一類的列 */
  const [hl, setHl] = useState<LcTag | null>(null);

  const tsLines = useMemo(() => toLines(problem.ts, 'ts'), [problem.ts]);
  const rustLines = useMemo(() => toLines(problem.rust, 'rust'), [problem.rust]);

  const counts = useMemo(() => {
    const out: Record<LcTag, number> = { borrow: 0, ownership: 0, option: 0, shared: 0, types: 0 };
    for (const row of problem.rows) if (row.tag) out[row.tag]++;
    return out;
  }, [problem.rows]);

  const index = problems.findIndex((p) => p.slug === problem.slug);
  const prev = index >= 0 ? problems[index - 1] : undefined;
  const next = index >= 0 ? problems[index + 1] : undefined;

  const related = problem.related.flatMap((slug) => {
    const i = pages.findIndex((p) => p.slug === slug);
    const page = pages[i];
    return page ? [{ slug, no: two(i + 1), title: page.title }] : [];
  });

  const files = Object.values(problem.verified.files);
  const verified = problem.verified.rustc !== '' && files.length > 0 && files.every((f) => f.success);

  // 拖曳選取時只選起點那一欄，複製出來才不會左右兩邊的程式碼交錯。
  // 直接寫在 DOM 的 data 屬性上，不經過重繪。
  const onPointerDown = (e: PointerEvent) => {
    const from = e.target instanceof Element ? e.target.closest('[data-col]') : null;
    const col = from instanceof HTMLElement ? from.dataset.col : undefined;
    const table = e.currentTarget;
    if (col && table instanceof HTMLElement) table.dataset.sel = col;
  };

  const onCopy = (e: ClipboardEvent) => {
    const text = getSelection()?.toString();
    if (!text || !e.clipboardData) return;
    e.clipboardData.setData('text/plain', text.replaceAll(NBSP, ' '));
    e.preventDefault();
  };

  return (
    <main class="lc" onCopy={onCopy}>
      <header class="lc-header">
        <p class="kicker">
          LeetCode 對照 · #{problem.number} · {problem.difficulty}
        </p>
        <div class="lc-title">
          <h1>{problem.title}</h1>
          <a class="lc-source" href={problem.url} target="_blank" rel="noreferrer">
            在 LeetCode 看題目
            <span aria-hidden="true"> ↗</span>
          </a>
        </div>
        <p class="lc-summary">{problem.summary}</p>
        {problem.lead.map((text) => (
          <p class="lc-lead" key={text}>
            {text}
          </p>
        ))}
      </header>

      <section class="lc-diff" aria-labelledby="lc-diff-title">
        <h2 id="lc-diff-title" class="lc-h2">
          逐行對照
        </h2>

        <div class="lc-legend">
          <ul class="lc-legend-items">
            {TAG_KEYS.map((tag) => {
              const n = counts[tag];
              return (
                <li key={tag}>
                  <button
                    type="button"
                    class={`lc-legend-item t-${tag}` + (hl === tag ? ' is-on' : '')}
                    disabled={n === 0}
                    aria-describedby="lc-legend-hint"
                    onMouseEnter={() => setHl(tag)}
                    onMouseLeave={() => setHl(null)}
                    onFocus={() => setHl(tag)}
                    onBlur={() => setHl(null)}
                  >
                    <i class="lc-swatch" aria-hidden="true" />
                    {LC_TAGS[tag].label}
                    <span class="lc-legend-count">
                      {n}
                      <span class="lc-sr"> 列</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p class="lc-legend-hint" id="lc-legend-hint" aria-live="polite">
            {hl ? `${LC_TAGS[hl].label}：${LC_TAGS[hl].hint}` : LEGEND_IDLE}
          </p>
        </div>

        <div class="lc-table" onPointerDown={onPointerDown}>
          <div class="lc-head">
            <h3 class="lc-col lc-col-ts">TypeScript</h3>
            <h3 class="lc-col lc-col-rust">Rust</h3>
            <h3 class="lc-col lc-col-note">Rust 多出來的</h3>
          </div>

          {problem.rows.map((row, i) => {
            const tag = row.tag;
            const dim = hl !== null && tag !== undefined && tag !== hl;
            const lit = hl !== null && tag === hl;
            const cls =
              'lc-row' + (tag ? ` has-tag t-${tag}` : '') + (dim ? ' is-dim' : '') + (lit ? ' is-lit' : '');
            const label = tag ? LC_TAGS[tag].label : '';
            return (
              <div
                key={i}
                class={cls}
                tabIndex={tag ? 0 : undefined}
                role={tag ? 'group' : undefined}
                aria-label={tag ? `${label}${row.note ? `：${row.note}` : ''}` : undefined}
              >
                <Cell col="ts" no={row.ts} line={row.ts === null ? undefined : tsLines[row.ts - 1]} />
                <Cell col="rust" no={row.rust} line={row.rust === null ? undefined : rustLines[row.rust - 1]} />
                {tag && (
                  <p class="lc-note" data-col="note">
                    <span class="lc-note-tag">{label}</span>
                    {row.note}
                  </p>
                )}
              </div>
            );
          })}

          <div class="lc-end" aria-hidden="true">
            <div />
            <div />
          </div>
        </div>

        {verified && (
          <p class="lc-verified">Rust 這一份連同測試用 rustc {problem.verified.rustc} 實際編譯、執行過。</p>
        )}
      </section>

      {related.length > 0 && (
        <section class="lc-related" aria-labelledby="lc-related-title">
          <h2 id="lc-related-title" class="lc-h2">
            這題用到的概念，在劇場裡演過
          </h2>
          <ul class="lc-related-cards">
            {related.map((r) => (
              <li key={r.slug}>
                <a class="lc-card" href={`#/${r.slug}`}>
                  <span class="lc-card-no">{r.no}</span>
                  <span class="lc-card-title">{r.title}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav class="lc-nav" aria-label="其他題目">
        <NavLink entry={prev} dir="prev" />
        <a class="lc-nav-index" href="#/?tab=lc">
          回首頁的分區索引
        </a>
        <NavLink entry={next} dir="next" />
      </nav>
    </main>
  );
}

function Cell({ col, no, line }: { col: 'ts' | 'rust'; no: number | null; line: CodeLine | undefined }) {
  // 這一側沒有對應的行
  if (no === null || !line) return <div class={`lc-cell lc-${col} is-empty`} aria-hidden="true" />;
  return (
    <div class={`lc-cell lc-${col}`} data-col={col}>
      <span class="ln" aria-hidden="true">
        {no}
      </span>
      {/* 折行後的續行比這一行的開頭再縮進 2 格（比照 CodePanel） */}
      <code style={`--hang:${line.indent + 2}ch`}>
        {NBSP.repeat(line.indent)}
        {line.tokens.map((tok) => (tok.type === 'txt' ? tok.text : <span class={`tok-${tok.type}`}>{tok.text}</span>))}
      </code>
    </div>
  );
}

function NavLink({ entry, dir }: { entry: LcEntry | undefined; dir: 'prev' | 'next' }) {
  const label = dir === 'prev' ? '上一題' : '下一題';
  if (!entry) {
    return (
      <span class={`lc-nav-link is-${dir} is-disabled`} role="link" aria-disabled="true">
        <span class="lc-nav-dir">{label}</span>
        <span class="lc-nav-title">{dir === 'prev' ? '這是第一題' : '這是最後一題'}</span>
      </span>
    );
  }
  return (
    <a class={`lc-nav-link is-${dir}`} href={`#/lc/${entry.slug}`}>
      <span class="lc-nav-dir">{label}</span>
      <span class="lc-nav-title">
        #{entry.number} {entry.title}
      </span>
    </a>
  );
}
