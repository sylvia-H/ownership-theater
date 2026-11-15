import type { PageEn } from '../../core/page.ts';

const en: PageEn = {
  kicker: 'Borrowing · Rust Book ch. 4',
  title: 'A borrow ends after its last use',
  lead: [
    'A JS line stays connected until its variable goes out of scope. Nothing marks it as no longer needed, and nothing has to, because JS has no borrow rules.',
    'A Rust borrow lives only until its last use. `r1` and `r2` go dark once they are printed, without waiting for the closing brace, so the next line can take a `&mut` without a conflict.',
  ],
  captions: [
    {
      js: 'An orb floats in the air; `s` points to it.',
      rust: 'The claw `s` holds the crystal.',
    },
    {
      js: '`r1` adds a second line to the same orb.',
      rust: 'A translucent beam from the lamp `r1` lights up.',
    },
    {
      js: '`r2` adds one more line.',
      rust: 'The beam from `r2` lights up as well; the two coexist.',
    },
    {
      js: 'The lines from `r1` and `r2` read the same orb.',
      rust: 'Both beams read the value. This is their last use.',
    },
    {
      js: 'The lines stay connected; they are cut only when the function ends.',
      rust: '`r1` and `r2` are never used again, so their beams go dark right now.',
    },
    {
      js: '`m` adds one more line: four lines to the same orb.',
      rust: 'With no beams in the way, the solid beam from `m` lights up.',
    },
    {
      js: 'The line from `m` changes the orb.',
      rust: '`m` changes the value; `m` is not used again either, so its beam goes dark.',
    },
    {
      js: 'Reading through `s` shows the changed value.',
      rust: 'With `m` dark too, the owner `s` can read the value directly.',
    },
    {
      js: 'All lines are cut. The orb waits for the GC.',
      rust: '`s` goes out of scope, and the value is dropped on the spot.',
    },
  ],
};

export default en;
