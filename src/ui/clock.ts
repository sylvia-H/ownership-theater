// 把 t 從目前值帶到目標值。速度是線性的：每一步內的緩動已經在 stateAt 裡做了。

import type { Store } from './store.ts';

export interface Clock {
  to(target: number, ms: number, done?: () => void): void;
  cancel(): void;
}

export const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createClock(store: Store<number>): Clock {
  let raf = 0;
  const cancel = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
  return {
    cancel,
    to(target, ms, done) {
      cancel();
      const from = store.get();
      if (prefersReducedMotion() || ms <= 0 || from === target) {
        store.set(target);
        done?.();
        return;
      }
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min(Math.max((now - start) / ms, 0), 1);
        store.set(p >= 1 ? target : from + (target - from) * p);
        if (p < 1) {
          raf = requestAnimationFrame(tick);
        } else {
          raf = 0;
          done?.();
        }
      };
      raf = requestAnimationFrame(tick);
    },
  };
}
