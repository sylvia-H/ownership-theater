import type { PageEn } from '../../core/page.ts';

const en: PageEn = {
  kicker: 'Lifetimes · Rust Book ch. 10',
  title: "`'a`: how long a returned reference lives",
  lead: [
    'A JS reference never expires: as long as one line still reaches a value, the value stays. A function can return a reference to any of its arguments, and nobody has to know how long it stays usable.',
    'A Rust reference is valid only for a limited region, its lifetime. A function that returns a reference must say which inputs it is tied to. The compiler goes by the shortest, so it cannot outlive its value.',
  ],
  captions: [
    {
      js: '`a` points to an orb.',
      rust: '`a` holds the first value.',
    },
    {
      js: '`result` does not point to anything yet.',
      rust: '`result` is declared, but its lamp is not lit yet.',
    },
    {
      js: '`b` points to a second orb.',
      rust: '`b` holds the second value, which lives only until the inner frame ends.',
    },
    {
      js: '`result` points to the orb with the longer string.',
      rust: "The beam lands on `a`, but `'a` ties it to `b` as well.",
    },
    {
      js: 'This side waits and prints outside the block.',
      rust: '`b` is still alive, so using `result` is fine.',
    },
    {
      js: 'A line has no expiry. It stays connected.',
      rust: '`result` is not used again, so its beam goes dark here.',
    },
    {
      js: 'The line from `b` is cut. Its orb waits for the GC.',
      rust: '`b` goes out of scope, and its value is dropped on the spot.',
    },
    {
      js: '`result` still works outside the block.',
      rust: 'No matching line on this side. Try Break it.',
    },
    {
      js: 'All lines are cut. The orbs wait for the GC.',
      rust: '`a` goes out of scope, and its value is dropped.',
    },
  ],
  breakIt: {
    hint: 'Break it: use `result` after `b` is dropped',
    plain:
      'The beam from `result` may live only as long as `b`. Using `result` after `b` is dropped does not compile, even though it really points to `a`: the compiler reads only the function signature.',
  },
};

export default en;
