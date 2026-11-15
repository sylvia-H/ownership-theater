// English act titles, keyed by slug (src/pages/index.ts).
// The home page and the LeetCode pages show titles without loading the acts, so the titles are repeated here.
// Each one must equal the `title` in that act's en.ts; src/i18n.test.ts checks it.
// Backticks mark inline code (see src/ui/inline.ts).

export const TITLES_EN: Record<string, string> = {
  move: 'Using `a` after `let b = a;`',
  'copy-vs-move': 'Integers are copied, Strings are moved',
  functions: 'Passing to a function, returning from one',
  'scope-drop': 'The moment a `{ }` block ends',
  'shared-borrow': '`&s`: borrow to look, not to take',
  'mut-borrow': '`&mut`: only one at a time',
  nll: 'A borrow ends after its last use',
  dangling: 'Returning a reference to a local variable',
  slices: 'Slices: borrowing only a part',
  option: '`null` and `Option<T>`',
  match: '`match` must cover every case',
  result: '`throw` and `Result<T, E>`',
  lifetimes: "`'a`: how long a returned reference lives",
  iterators: '`map` and `filter` do no work until `collect`',
  rc: '`Rc<T>`: one value, many owners',
  refcell: '`RefCell<T>`: borrow rules checked at run time',
  'rc-refcell': '`Rc<RefCell<T>>`: the JS default, spelled out in Rust',
};
