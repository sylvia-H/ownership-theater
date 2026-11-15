import type { PageEn } from '../../core/page.ts';

const en: PageEn = {
  kicker: 'Finale · Rust Book ch. 15',
  title: '`Rc<RefCell<T>>`: the JS default, spelled out in Rust',
  lead: [
    'Two names point to one object, either can change it, and the other sees the change at once. You write this in JS every day, because it is the default.',
    'Rust can do the same thing, but you have to say so: Rc for shared, RefCell for mutable. The difference between the two languages is not what is possible. It is what is the default.',
  ],
  captions: [
    {
      js: '`a` points to the array `[1, 2]`.',
      rust: '`a` points to the value, which is declared both shared and mutable.',
    },
    {
      js: '`b` adds a second line to the same orb.',
      rust: '`Rc::clone` makes `b` a second owner of the same value. The count goes to 2.',
    },
    {
      js: 'The value is changed through `b`.',
      rust: '`b` borrows mutably, changes the value, and gives the borrow right back.',
    },
    {
      js: '`a` sees the change made through `b`.',
      rust: '`a` borrows to read and sees the change made through `b`.',
    },
    {
      js: 'How many lines reach the orb? Only the GC knows.',
      rust: 'The count is 2, a number your code can read.',
    },
    {
      js: 'The line from `b` is cut. The orb is still there.',
      rust: '`b` is dropped. The count falls to 1, and the value stays.',
    },
    {
      js: 'Both sides look the same. Here it is the default, with nothing to spell out.',
      rust: 'Dropped at zero. The difference is not what is possible, it is what is the default.',
    },
  ],
};

export default en;
