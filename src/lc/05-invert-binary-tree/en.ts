import type { LcEn } from '../types.ts';

const en: LcEn = {
  summary: 'Rust adds 6 things, half of them Rc and RefCell: the sharing and mutation JS gives by default are written out here.',
  lead: [
    'The tree node type LeetCode provides has three layers: Option because there may be no node, Rc so the node can be shared, RefCell so it can be mutated. TS needs only `TreeNode | null`.',
    'The solution is the same recursion. The extra steps are `borrow_mut`, which asks the RefCell for mutable access, and `take`, which moves a subtree out and hands it to the recursive call.',
  ],
  teaser: 'Shared and mutable: in Rust, both go in the type.',
  notes: {
    5: 'Three layers, one job each: Option for maybe absent, Rc for shared, RefCell for mutable.',
    6: 'A JS object reference is shareable and mutable by default. Rust puts both in the type.',
    11: 'Borrows `root` to open it: do the work only if there is a node, and keep `root` to return at the end.',
    12: '`borrow_mut` asks the RefCell for mutable access to the node. An overlapping borrow panics at run time.',
    13: '`take` moves the whole left subtree out for the recursive call and leaves None there for now.',
    14: 'Same for the right subtree: move it out now, and put it back on the other side below.',
  },
};

export default en;
