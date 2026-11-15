import type { LcEn } from '../types.ts';

const en: LcEn = {
  summary: 'Rust adds 5 things: each string is moved into the map and back out, never copied, and `collect` needs two type annotations.',
  lead: [
    "Sort each string's letters and use the result as the key; strings with the same key share a group. The TS Map holds references, so the input array stays intact. Rust moves each String out of `strs` and into the map.",
    'The `entry` line looks the most different: it finds the slot and borrows it in one step, replacing the TS check, set, and get. At the end, `into_values` moves every group out of the map at once.',
  ],
  teaser: 'Strings are moved into the map, not copied.',
  notes: {
    5: '`for` consumes `strs`: each `s` is moved out of the vector, not copied.',
    6: '`collect` can build many kinds of collection, so the annotation says this one is a `Vec<char>`.',
    8: 'The same `collect`, annotated as String, joins the chars back into a string.',
    9: 'Check-then-insert would borrow the map twice. `entry` borrows the slot once, and `s` moves straight in.',
    11: '`into_values` consumes the map and moves every group out. No string is copied.',
  },
};

export default en;
