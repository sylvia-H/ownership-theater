import type { LcTag } from './types.ts';

/** English version of LC_TAGS (types.ts): same keys, same order. */
export const LC_TAGS_EN: Record<LcTag, { label: string; hint: string }> = {
  borrow: { label: 'Borrowing', hint: '& and &mut: use a value without taking it' },
  ownership: { label: 'Moving ownership', hint: 'The value moves to a new owner; the old binding can no longer use it' },
  option: { label: 'Handling Option', hint: 'There may be no value, so you open it before you use it' },
  shared: { label: 'Shared ownership', hint: 'Rc and RefCell: several owners, with borrows checked at run time' },
  types: { label: 'Types and conversions', hint: 'Type annotations, as casts, usize and i32' },
};
