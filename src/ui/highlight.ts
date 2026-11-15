// 極小的上色器：片段都是十行以內的教學程式碼，不值得載一個 highlighter。

import type { Lang } from '../core/timeline.ts';

export type TokenType = 'com' | 'str' | 'num' | 'kw' | 'mac' | 'ty' | 'txt';

export interface Token {
  type: TokenType;
  text: string;
}

const KEYWORDS: Record<Lang, ReadonlySet<string>> = {
  rust: new Set(
    (
      'as break const continue else enum false fn for if impl in let loop match mod move mut pub ref return ' +
      'self static struct trait true type use where while'
    ).split(' '),
  ),
  ts: new Set(
    (
      'break case catch class const default else export extends false for from function if import in interface ' +
      'let new null of return switch throw true try type typeof undefined var while'
    ).split(' '),
  ),
};

// 分組：1 註解、2 字串、3 數字、4 識別字（Rust 的巨集帶結尾的 !）、5 其他。
// Rust 不把單引號當字串，否則生命週期標註 'a 會被吃掉。
const PATTERN: Record<Lang, RegExp> = {
  rust: /(\/\/.*$)|("(?:[^"\\]|\\.)*")|(\b\d[\d_]*(?:\.\d+)?\b)|([A-Za-z_]\w*(?:!(?!=))?)|(\s+|.)/g,
  ts: /(\/\/.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d[\d_]*(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|(\s+|.)/g,
};

export function tokenize(line: string, lang: Lang): Token[] {
  const out: Token[] = [];
  const push = (type: TokenType, text: string) => {
    const last = out[out.length - 1];
    if (last && type === 'txt' && last.type === 'txt') last.text += text;
    else out.push({ type, text });
  };
  for (const m of line.matchAll(PATTERN[lang])) {
    if (m[1] !== undefined) push('com', m[1]);
    else if (m[2] !== undefined) push('str', m[2]);
    else if (m[3] !== undefined) push('num', m[3]);
    else if (m[4] !== undefined) {
      const word = m[4];
      if (word.endsWith('!')) push('mac', word);
      else if (KEYWORDS[lang].has(word)) push('kw', word);
      else if (/^[A-Z]/.test(word)) push('ty', word);
      else push('txt', word);
    } else push('txt', m[0]);
  }
  return out;
}
