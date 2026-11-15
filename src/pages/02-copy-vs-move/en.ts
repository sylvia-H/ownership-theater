import type { PageEn } from '../../core/page.ts';

const en: PageEn = {
  kicker: 'Ownership · Rust Book ch. 4',
  title: 'Integers are copied, Strings are moved',
  lead: [
    '`let y = x;` and `let t = s;` look identical, yet the values end up differently. Small fixed-size values such as integers are Copy types: assignment makes a new copy, and the original variable stays usable.',
    'A String keeps its contents on the heap, where copying costs real work, so Rust never copies it behind your back; it moves it. JS has the same split: numbers are copied, objects are shared.',
  ],
  captions: [
    {
      js: 'A number is a primitive: the bead sits right on `x`.',
      rust: '5 is an integer; `x` holds this small chip.',
    },
    {
      js: 'Numbers are copied too: `y` gets its own bead, independent of `x`.',
      rust: 'Integers are Copy: `y` gets a new chip, and `x` keeps its own.',
    },
    {
      js: '`x` and `y` each have their own 5, and both work.',
      rust: '`x` and `y` each hold a 5, and both are usable.',
    },
    {
      js: 'An object is an orb floating in the air; `s` points to it.',
      rust: 'A String keeps its contents on the heap; the claw `s` holds the crystal.',
    },
    {
      js: 'Same syntax, but no copy this time: `t` adds a second line to the same orb.',
      rust: 'Same syntax, but String is not Copy: the whole crystal moves to `t`.',
    },
    {
      js: 'The line from `t` reaches the orb; the line from `s` is still there too.',
      rust: '`t` holds the value, so only `t` can use it; `s` is an empty shell.',
    },
    {
      js: 'The beads vanish with their variables; the orb has no lines and waits for the GC.',
      rust: 'The variables go out of scope, and every value they hold is dropped on the spot.',
    },
  ],
};

export default en;
