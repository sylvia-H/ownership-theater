// 介面語言：繁體中文或英文。一個全站共用的 store，切換時不重新載入頁面。
// 初始值的優先序：網址 hash 的 lang 參數 → localStorage 記住的選擇 → 瀏覽器語言。

import { createStore, type Store } from './store.ts';

export type Lang = 'zh' | 'en';

const STORAGE_KEY = 'ownership-theater:lang';

export const isLang = (value: unknown): value is Lang => value === 'zh' || value === 'en';

/** hash（`#/move?t=1.5&lang=en`）裡的 lang 參數；沒有或不認得就是 null */
export function langFromHash(hash: string): Lang | null {
  const query = hash.split('?')[1] ?? '';
  const value = new URLSearchParams(query).get('lang');
  return isLang(value) ? value : null;
}

/** 把 hash 裡的 lang 參數拿掉，其餘（slug、t、tab）不動 */
export function stripLangFromHash(hash: string): string {
  const [path = '', query] = hash.split('?');
  if (query === undefined) return hash;
  const params = new URLSearchParams(query);
  params.delete('lang');
  const rest = params.toString();
  return rest ? `${path}?${rest}` : path;
}

/** 純函式：三個來源依序決定初始語言 */
export function pickLang(fromHash: string | null, stored: string | null, navigatorLanguage: string | undefined): Lang {
  if (isLang(fromHash)) return fromHash;
  if (isLang(stored)) return stored;
  return (navigatorLanguage ?? '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(lang: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // 無痕模式或被封鎖：這次有效就好
  }
}

const SITE_NAME: Record<Lang, string> = { zh: '所有權劇場', en: 'Ownership Theater' };
export const siteName = (lang: Lang): string => SITE_NAME[lang];

function initial(): Lang {
  if (typeof location === 'undefined') return 'zh';
  const fromHash = langFromHash(location.hash);
  // 網址明講的語言也記下來，之後站內換頁、重新整理都維持
  if (fromHash) writeStored(fromHash);
  return pickLang(fromHash, readStored(), typeof navigator === 'undefined' ? undefined : navigator.language);
}

const store: Store<Lang> = createStore<Lang>(initial());

function applyToDocument(lang: Lang): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : 'en';
}
applyToDocument(store.get());
store.subscribe(applyToDocument);

export const getLang = (): Lang => store.get();
export const subscribeLang = (fn: (lang: Lang) => void): (() => void) => store.subscribe(fn);

/** 使用者按切換鈕：記住選擇，並把網址上的 lang 參數拿掉（否則重新整理會被網址蓋回去） */
export function setLang(lang: Lang): void {
  writeStored(lang);
  if (typeof location !== 'undefined' && langFromHash(location.hash)) {
    history.replaceState(null, '', location.pathname + location.search + stripLangFromHash(location.hash));
  }
  store.set(lang);
}

/** 換頁後的網址帶著 lang 參數（例如別人給的連結）：照它切換 */
export function syncLangFromHash(): void {
  const fromHash = langFromHash(location.hash);
  if (fromHash && fromHash !== store.get()) {
    writeStored(fromHash);
    store.set(fromHash);
  }
}
