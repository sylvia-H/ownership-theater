import type { RefObject } from 'preact';
import type { Step } from '../core/trace.ts';

interface Props {
  steps: number;
  /** 目前步驟索引；-1 是還沒開始 */
  idx: number;
  step: Step | undefined;
  playing: boolean;
  sliderRef: RefObject<HTMLInputElement | null>;
  onScrub(t: number): void;
  onRelease(): void;
  onPrev(): void;
  onNext(): void;
  onTogglePlay(): void;
}

export function Timeline(p: Props) {
  const done = p.idx + 1;
  return (
    <section class="timeline" aria-label="時間軸">
      <div class="caption" aria-live="polite">
        {p.step ? (
          <>
            <p class="cap cap-js">
              <span class="cap-tag">JS</span>
              {p.step.caption.js}
            </p>
            <p class="cap cap-rust">
              <span class="cap-tag">Rust</span>
              {p.step.caption.rust}
            </p>
          </>
        ) : (
          <p class="cap cap-idle">拖動滑桿，或按 → 開始</p>
        )}
      </div>
      <div class="transport">
        <div class="transport-buttons">
          <button type="button" class="btn" onClick={p.onPrev} disabled={p.idx < 0} aria-label="上一步">
            ‹
          </button>
          <button type="button" class="btn btn-play" onClick={p.onTogglePlay} aria-pressed={p.playing}>
            {p.playing ? '暫停' : '播放'}
          </button>
          <button type="button" class="btn" onClick={p.onNext} disabled={done >= p.steps} aria-label="下一步">
            ›
          </button>
        </div>
        <div class="scrub">
          <input
            ref={p.sliderRef}
            class="slider"
            type="range"
            min={0}
            max={p.steps}
            step={0.001}
            aria-label="時間軸"
            aria-valuetext={`第 ${done} 步，共 ${p.steps} 步`}
            onInput={(e) => p.onScrub(Number(e.currentTarget.value))}
            onChange={p.onRelease}
          />
          <div class="ticks" aria-hidden="true">
            {Array.from({ length: p.steps + 1 }, (_, k) => (
              <span key={k} class={'tick' + (k <= done ? ' is-done' : '') + (k === done ? ' is-now' : '')}>
                {k}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
