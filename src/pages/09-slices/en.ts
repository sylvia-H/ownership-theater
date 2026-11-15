import type { PageEn } from '../../core/page.ts';

const en: PageEn = {
  kicker: 'Borrowing · Rust Book ch. 4',
  title: 'Slices: borrowing only a part',
  lead: [
    'In JS, `slice()` makes a new value that holds part of the original. From then on the two values go their separate ways.',
    'In Rust, a slice is a beam that lights only part of a value. Nothing is copied, and the slice does not own the value. `&str` lights part of a string; `&[T]` lights part of an array.',
  ],
  captions: [
    {
      js: 'A string is a primitive: the bead sits right on `s`.',
      rust: 'The claw `s` holds the whole string.',
    },
    {
      js: '`slice` makes a new string and gives it to `hello`.',
      rust: 'The beam from `hello` lights only the first five bytes of the string.',
    },
    {
      js: 'This reads the newly made string.',
      rust: 'The beam reads one part of the value that `s` holds.',
    },
    {
      js: 'An array is an orb; `nums` points to it.',
      rust: 'The claw `nums` holds the whole array.',
    },
    {
      js: '`slice` makes another new orb, and `mid` points to it.',
      rust: 'The beam from `mid` lights only two elements in the middle of the array.',
    },
    {
      js: 'This reads the copied `[2, 3]`.',
      rust: 'The beam reads one part of `nums`.',
    },
    {
      js: 'All lines are cut; the two array orbs wait for the GC.',
      rust: 'Both values are dropped as their owners go out of scope.',
    },
  ],
};

export default en;
