import type { LcEn } from '../types.ts';

const en: LcEn = {
  summary: 'Rust adds 2 things, and both make the same point: to modify in place, you first need a `&mut` borrow.',
  lead: [
    'The problem asks for an in-place reversal with no second array. A TS array passed to a function can always be modified. Rust puts `&mut` in the signature, and the caller has to say it is lending the vector for writing.',
    'To swap two slots, Rust will not let you hold mutable references to two elements at once, so `swap` does the exchange in one call. The two-pointer walk is exactly the same.',
  ],
  teaser: 'In-place mutation: you need a `&mut` borrow before you can write.',
  notes: {
    2: '`&mut` borrows the vector for writing. The borrow ends when the function returns, so nothing is returned.',
    6: 'You cannot hold mutable references to two elements at once, so `swap` exchanges them in one call.',
  },
};

export default en;
