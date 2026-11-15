import { useMemo } from 'preact/hooks';
import type { Lang } from '../core/timeline.ts';
import { tokenize } from './highlight.ts';
import { STRINGS } from './strings.ts';
import { useLang } from './useLang.ts';

interface Props {
  lang: Lang;
  title: string;
  code: string;
  /** 目前這一步對應的行；這個語言沒有對應行時是 null */
  current: number | null;
  /** 從場景指過來要發亮的行 */
  hot: ReadonlySet<number> | null;
  /** 有對應步驟、可以點的行 */
  pickable: ReadonlySet<number>;
  onEnter(line: number): void;
  onLeave(): void;
  onPick(line: number): void;
}

export function CodePanel({ lang, title, code, current, hot, pickable, onEnter, onLeave, onPick }: Props) {
  const S = STRINGS[useLang()];
  const lines = useMemo(
    () =>
      code
        .replace(/\r\n/g, '\n')
        .replace(/\n+$/, '')
        .split('\n')
        .map((text) => ({ tokens: tokenize(text, lang), indent: text.length - text.trimStart().length })),
    [code, lang],
  );

  return (
    <section class={`code code-${lang}`} aria-label={S.codeLabel(title)}>
      <h2 class="code-title">{title}</h2>
      <ol class="code-lines">
        {lines.map(({ tokens, indent }, i) => {
          const line = i + 1;
          const cls = 'line' + (line === current ? ' is-current' : '') + (hot?.has(line) ? ' is-hot' : '');
          const body = (
            <>
              <span class="ln" aria-hidden="true">
                {line}
              </span>
              {/* 折行後的續行比這一行的開頭再縮進 2 格 */}
              <code style={`--hang:${indent + 2}ch`}>
                {tokens.map((tok) =>
                  tok.type === 'txt' ? tok.text : <span class={`tok-${tok.type}`}>{tok.text}</span>,
                )}
              </code>
            </>
          );
          return (
            <li key={line}>
              {pickable.has(line) ? (
                <button
                  type="button"
                  class={cls}
                  aria-current={line === current ? 'step' : undefined}
                  onMouseEnter={() => onEnter(line)}
                  onMouseLeave={onLeave}
                  onFocus={() => onEnter(line)}
                  onBlur={onLeave}
                  onClick={() => onPick(line)}
                >
                  {body}
                </button>
              ) : (
                <div class={cls}>{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
