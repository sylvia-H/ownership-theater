import type { PageEn } from '../../core/page.ts';

const en: PageEn = {
  kicker: 'Smart pointers · Rust Book ch. 15',
  title: '`RefCell<T>`: borrow rules checked at run time',
  lead: [
    'JS has no borrow rules. Anyone who can reach a value can change it, with nothing to register first and nothing to give back.',
    "RefCell moves Rust's borrow rules from compile time to run time: `borrow_mut` registers a mutable borrow, and you give it back when done. Register a second one too early and the code compiles, then panics when it runs.",
  ],
  captions: [
    {
      js: '`cell` points to the array `[1, 2]`.',
      rust: '`cell` holds the value, wrapped in a RefCell casing.',
    },
    {
      js: '`w` adds a second line. Nothing to register.',
      rust: 'The borrow is registered at run time, and the solid beam from `w` lights up.',
    },
    {
      js: 'The value is changed through `w`.',
      rust: 'The value is changed through `w`.',
    },
    {
      js: 'There is no giving back on this side. The line from `w` stays.',
      rust: 'Only `drop(w)` gives the borrow back. Nothing is registered now.',
    },
    {
      js: '`w2` adds one more line. All three lines can change the value.',
      rust: 'No borrow is registered, so the beam from `w2` lights up.',
    },
    {
      js: 'The value is changed again through `w2`.',
      rust: 'The value is changed again through `w2`.',
    },
    {
      js: 'Print `[1, 2, 3, 4]`.',
      rust: 'Print `[1, 2, 3, 4]`.',
    },
    {
      js: 'All lines are cut. The orb waits for the GC.',
      rust: '`w2` gives its borrow back, then the value is dropped along with `cell`.',
    },
  ],
  breakIt: {
    hint: 'Break it: call `borrow_mut` again while `w` is lit',
    plain:
      'Same rule as `&mut`: one at a time. This is not a compile error: the code compiles, then panics at run time on the second `borrow_mut()`. `w` is a guard; the borrow stays until `w` is dropped.',
  },
};

export default en;
