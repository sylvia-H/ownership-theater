import { useEffect, useState } from 'preact/hooks';
import { getLang, subscribeLang, type Lang } from './lang.ts';

/** 目前的介面語言；切換時重繪用到它的元件 */
export function useLang(): Lang {
  const [lang, setLangState] = useState(getLang);
  useEffect(() => {
    setLangState(getLang());
    return subscribeLang(setLangState);
  }, []);
  return lang;
}
