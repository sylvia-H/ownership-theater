import type { LcEn } from '../types.ts';

const en: LcEn = {
  summary: 'Rust adds 3 things: two type conversions and one Option to open. The algorithm is identical.',
  lead: [
    'Both versions do the same thing: walk the array, record each number in a map, and at every number check whether the other half of the pair has already appeared.',
    'Rust adds only a few symbols: the lookup borrows `need`, `if let` covers the case where nothing is found, and each index is cast to `i32` by hand. This problem is the baseline for the other four.',
  ],
  teaser: 'The baseline: the same algorithm, plus a few extra symbols.',
  notes: {
    7: 'The lookup only borrows `need` (`&`). It may find nothing, so `if let` opens the Option.',
    8: 'An index is a `usize` and the problem wants `i32`. Rust never converts implicitly, so you write `as`.',
    10: 'The index stored in the map gets the same cast to `i32`.',
  },
};

export default en;
