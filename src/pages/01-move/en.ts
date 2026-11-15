import type { PageEn } from '../../core/page.ts';

const en: PageEn = {
  kicker: 'Ownership · Rust Book ch. 4',
  title: 'Using `a` after `let b = a;`',
  lead: [
    'In JS, `b = a` adds a second line to the same value. Nothing is copied and nothing is moved, so both names, `a` and `b`, can keep using it.',
    'In Rust, every value has exactly one owner at a time. `let b = a;` moves the whole value into `b`, and `a` can no longer be used. This is called a move.',
  ],
  captions: [
    {
      js: 'An orb floats in the air; variable `a` points to it.',
      rust: 'The claw `a` holds the value, shown as a crystal.',
    },
    {
      js: '`b` adds a second line to the same orb.',
      rust: 'The whole crystal moves to `b`; `a` is left as an empty shell.',
    },
    {
      js: 'The line from `b` reaches the orb, so `b` can use it.',
      rust: '`b` holds the value, so using it through `b` is fine.',
    },
    {
      js: 'The line from `a` is still there, so `a` works too.',
      rust: 'No matching line on this side: it would not compile. Try Break it.',
    },
    {
      js: 'All lines are cut. The orb waits for the GC.',
      rust: '`b` goes out of scope, and the value is dropped on the spot: the crystal shatters.',
    },
  ],
  breakIt: {
    hint: 'Break it: drag "hello" back to `a`',
    plain:
      'The value has moved to `b`, and `a` is an empty shell. Rust rejects this line at compile time instead of letting it fail at run time.',
  },
};

export default en;
