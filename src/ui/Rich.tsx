import { splitInlineCode } from './inline.ts';

/** 把成對反引號之間的文字畫成行內程式碼，其餘照舊 */
export function Rich({ text }: { text: string }) {
  if (!text.includes('`')) return <>{text}</>;
  return (
    <>
      {splitInlineCode(text).map((s) => (s.code ? <code class="ic">{s.text}</code> : s.text))}
    </>
  );
}
