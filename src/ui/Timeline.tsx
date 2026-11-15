import type { RefObject } from 'preact';
import type { Step } from '../core/trace.ts';
import { Rich } from './Rich.tsx';
import { STRINGS } from './strings.ts';
import { useLang } from './useLang.ts';

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
  const S = STRINGS[useLang()];
  return (
    <section class="timeline" aria-label={S.timeline}>
      <div class="caption" aria-live="polite">
        {p.step ? (
          <>
            <p class="cap cap-js">
              <span class="cap-tag">JS</span>
              <Rich text={p.step.caption.js} />
            </p>
            <p class="cap cap-rust">
              <span class="cap-tag">Rust</span>
              <Rich text={p.step.caption.rust} />
            </p>
          </>
        ) : (
          <p class="cap cap-idle">{S.timelineIdle}</p>
        )}
      </div>
      <div class="transport">
        <div class="transport-buttons">
          <button type="button" class="btn" onClick={p.onPrev} disabled={p.idx < 0} aria-label={S.prevStep}>
            ‹
          </button>
          <button type="button" class="btn btn-play" onClick={p.onTogglePlay} aria-pressed={p.playing}>
            {p.playing ? S.pause : S.play}
          </button>
          <button type="button" class="btn" onClick={p.onNext} disabled={done >= p.steps} aria-label={S.nextStep}>
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
            aria-label={S.timeline}
            aria-valuetext={S.stepOf(done, p.steps)}
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
