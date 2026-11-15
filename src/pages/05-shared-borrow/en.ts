import type { PageEn } from '../../core/page.ts';

const en: PageEn = {
  kicker: 'Borrowing · Rust Book ch. 4',
  title: '`&s`: borrow to look, not to take',
  lead: [
    'In JS, `r1 = s` adds another line to the same value. Every line can read it and every line can change it; none of them is the owner.',
    'In Rust, `&s` borrows the value from its owner to look at it: `s` still holds the value, and `r1` and `r2` are only beams shining on it. Any number of shared borrows can exist at once, but all of them are read-only.',
  ],
  captions: [
    {
      js: 'An orb floats in the air; `s` points to it.',
      rust: 'The claw `s` holds the crystal.',
    },
    {
      js: '`r1` adds a second line to the same orb.',
      rust: 'A translucent beam from the lamp `r1` lights up; `s` still holds the value.',
    },
    {
      js: '`r2` adds one more: three lines to the same orb.',
      rust: 'A second beam lights up; shared borrows can coexist.',
    },
    {
      js: 'The lines from `r1` and `r2` read the same orb.',
      rust: 'Both beams read the value, then go dark once the read is done.',
    },
    {
      js: 'The line from `s` is still there, and it can read too.',
      rust: 'The owner `s` has held the value all along, and it can read too.',
    },
    {
      js: 'All lines are cut. The orb waits for the GC.',
      rust: '`s` goes out of scope, and the value is dropped on the spot.',
    },
  ],
};

export default en;
