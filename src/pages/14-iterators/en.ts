import type { PageEn } from '../../core/page.ts';

const IDLE = 'Nothing happens here: the values are already computed.';

const en: PageEn = {
  kicker: 'Iterators and closures · Rust Book ch. 13',
  title: '`map` and `filter` do no work until `collect`',
  lead: [
    'On a JS array, `map` and `filter` do their work right away: each call walks the whole array and hands back a new one, and the next call starts from that new array.',
    'In Rust, `map` and `filter` only connect the stages of a pipeline; nothing is computed yet. When `collect` or `sum` asks for a result, values flow through the whole pipeline one at a time, with no arrays in between.',
  ],
  captions: [
    {
      js: '`v` points to the array `[1, 2, 3]`.',
      rust: '`v` holds `[1, 2, 3]`.',
    },
    {
      js: '`map` runs right away and produces a new array.',
      rust: 'One pipeline stage is attached. Nothing is computed yet.',
    },
    {
      js: '`filter` runs right away too and produces another new array.',
      rust: 'Another stage is attached. Still no value has flowed.',
    },
    {
      js: 'Both intermediate arrays already exist.',
      rust: 'Up to here, not a single value has been computed.',
    },
    {
      js: '`out` adds a second line to the same array.',
      rust: '`collect` asks for results. The pipeline gets an exit into `out`, an empty Vec.',
    },
    {
      js: IDLE,
      rust: '1 becomes 2, and `filter` stops it.',
    },
    {
      js: IDLE,
      rust: '2 becomes 4, passes `filter`, and lands in `out`.',
    },
    {
      js: IDLE,
      rust: '3 becomes 6 and passes too. One value flows at a time.',
    },
    {
      js: IDLE,
      rust: 'All values are through. The pipeline is gone, and `v` is no longer borrowed.',
    },
    {
      js: 'Print `[4, 6]`.',
      rust: 'Print `[4, 6]`.',
    },
    {
      js: 'All three orbs wait for the GC.',
      rust: '`out` and `v` go out of scope and are dropped on the spot.',
    },
  ],
};

export default en;
