import type { PageEn } from '../../core/page.ts';

const en: PageEn = {
  kicker: 'Smart pointers · Rust Book ch. 15',
  title: '`Rc<T>`: one value, many owners',
  lead: [
    'In JS, several names pointing to one value is the default, and you write nothing extra. The GC decides when the value is freed; your code cannot see that moment or count the references.',
    'In Rust, a value has one owner by default. When you do need sharing, wrap the value in Rc: each new owner adds one to the reference count, each owner that leaves subtracts one, and the value is dropped at zero.',
  ],
  captions: [
    {
      js: '`a` points to an orb.',
      rust: '`a` owns the value. The reference count is 1.',
    },
    {
      js: '`b` adds a second line to the same orb.',
      rust: '`Rc::clone` makes `b` a second owner of the same value. The count goes to 2.',
    },
    {
      js: '`b` reaches the value. There is no count to look at.',
      rust: 'Print "hello" and the count, 2.',
    },
    {
      js: 'The line from `b` is cut. The orb is still there.',
      rust: '`b` goes out of scope. The count falls to 1, and the value stays.',
    },
    {
      js: '`a` still reaches the value.',
      rust: 'Print "hello" and the count, 1.',
    },
    {
      js: 'The last line is cut. The orb waits for the GC.',
      rust: 'The count reaches zero, and only now is the value dropped.',
    },
  ],
};

export default en;
