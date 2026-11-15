import type { PageEn } from '../../core/page.ts';

const en: PageEn = {
  kicker: 'Borrowing · Rust Book ch. 4',
  title: 'Returning a reference to a local variable',
  lead: [
    'In JS, a function can return a local object without trouble: as long as a line still points to it, the GC leaves it alone. A line never leads to something that is gone.',
    'In Rust, a local variable is dropped when the function ends, and a reference to it would dangle, so the compiler rejects it. To get the value out, hand over ownership.',
  ],
  captions: [
    {
      js: '`main` calls `make`; `r` does not point to anything yet.',
      rust: '`main` calls `make`; `r` is still empty.',
    },
    {
      js: 'An orb appears inside `make`, and `s` points to it.',
      rust: 'Inside `make`, the claw `s` holds the crystal.',
    },
    {
      js: 'The same orb is returned, and `r` points to it.',
      rust: 'The whole crystal moves out of the function, into `r`.',
    },
    {
      js: 'The line from `s` is cut; `r` still points to the orb, so it is not collected.',
      rust: '`make` ends; `s` is only an empty shell, so nothing is dropped.',
    },
    {
      js: 'The line from `r` reads the orb.',
      rust: '`r` holds the value and uses it as usual.',
    },
    {
      js: 'All lines are cut. The orb waits for the GC.',
      rust: '`r` goes out of scope, and the value is dropped on the spot.',
    },
  ],
  breakIt: {
    hint: 'Break it: keep the value, return only a `&` to `s`',
    plain:
      '`s` is dropped when `make` ends, so the returned reference would shine on a pile of shards. Rust does not wait for run time; it rejects this at compile time.',
  },
};

export default en;
