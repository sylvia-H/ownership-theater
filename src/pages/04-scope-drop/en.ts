import type { PageEn } from '../../core/page.ts';

const en: PageEn = {
  kicker: 'Ownership · Rust Book ch. 4',
  title: 'The moment a `{ }` block ends',
  lead: [
    'In Rust, a value lives as long as the variable that owns it. The moment that variable leaves the `{ }` where it was declared, the value is dropped and its memory is returned right away.',
    'In JS, leaving a `{ }` only cuts the line from the variable. The value stays in memory until the garbage collector (GC) comes by at some unknown time. Rust has no GC; it relies on this rule instead.',
  ],
  captions: [
    {
      js: 'An orb floats in the air; variable `a` points to it.',
      rust: 'The claw `a` holds "outer".',
    },
    {
      js: 'Enter the inner `{ }` frame: variables declared inside it live only inside it.',
      rust: 'Enter the inner `{ }` frame: variables declared inside it live only inside it.',
    },
    {
      js: 'A second orb appears, and `b` points to it.',
      rust: 'The inner claw `b` holds "inner".',
    },
    {
      js: 'The inner block can use `a` from outside as well as its own `b`.',
      rust: 'The inner block can use `a` from outside as well as its own `b`.',
    },
    {
      js: 'The line from `b` is cut. Nothing points to the orb, yet it still floats there.',
      rust: 'At the closing `}`, the value that `b` holds is dropped on the spot.',
    },
    {
      js: 'Using `a` works as usual; the unreachable orb still takes up memory.',
      rust: 'Using `a` works as usual; the memory for "inner" was returned long ago.',
    },
    {
      js: 'At some unknown moment the GC sweeper passes and collects the orb with no lines.',
      rust: 'There is no GC, so nothing happens in this step.',
    },
    {
      js: 'The line from `a` is cut as well; this orb now waits for the GC.',
      rust: '`a` goes out of scope, and "outer" is dropped on the spot too.',
    },
  ],
};

export default en;
