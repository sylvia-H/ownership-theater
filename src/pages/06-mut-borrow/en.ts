import type { PageEn } from '../../core/page.ts';

const en: PageEn = {
  kicker: 'Borrowing · Rust Book ch. 4',
  title: '`&mut`: only one at a time',
  lead: [
    'In JS, any line can change the value. The other lines to the same value get no warning; the next time they read, they see the changed version.',
    'In Rust, changing a borrowed value takes `&mut`. It is a single solid beam: while it is lit, no other borrow may exist, so no reader can have the value swapped out in the middle of a read.',
  ],
  captions: [
    {
      js: 'An orb floats in the air; `s` points to it.',
      rust: 'The claw `s` holds the crystal.',
    },
    {
      js: '`r` adds a second line to the same orb.',
      rust: 'A translucent beam from the lamp `r` lights up; it can only read.',
    },
    {
      js: 'The line from `r` reads the orb.',
      rust: '`r` reads the value and is never used again, so its beam goes dark.',
    },
    {
      js: '`m` adds one more line, no different from the one from `r`.',
      rust: 'A solid beam from the lamp `m` lights up, the only beam on the value.',
    },
    {
      js: 'The line from `m` changes the orb.',
      rust: 'The solid beam changes the value; no one else is looking at it now.',
    },
    {
      js: 'Reading through `m` shows the changed value.',
      rust: 'Reading through `m` shows the changed value; then the beam goes dark.',
    },
    {
      js: 'The line from `r` was never cut, and it now reads the changed value.',
      rust: 'No matching line on this side: the beam from `r` went dark long ago.',
    },
    {
      js: 'All lines are cut. The orb waits for the GC.',
      rust: '`s` goes out of scope, and the value is dropped on the spot.',
    },
  ],
  breakIt: {
    hint: 'Break it: add a `&mut` while the `&` is still lit',
    plain:
      'The shared borrow `r` is still needed later, so a `&mut` cannot be handed out now. Otherwise the value could change while `r` is in the middle of reading it.',
  },
};

export default en;
