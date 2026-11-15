import type { LcEn } from '../types.ts';

const en: LcEn = {
  summary: 'Rust adds 5 things, and all of them answer the same question: who owns this node right now?',
  lead: [
    'Reversing a list only means turning the `next` of each node the other way. In TS, several variables can point to the same node at once. With Box, Rust gives every node exactly one owner.',
    'So every step is a move: `take` moves the next node out and hands it to `curr`, then `node` moves into `prev` whole. The last line of the TS loop, `curr = next`, has no counterpart in Rust.',
  ],
  teaser: 'Every step has to say who owns the node now.',
  notes: {
    3: 'Box: the next node is owned by this node alone. Option takes the place of `null`.',
    7: '`head` is not borrowed: the whole list moves into the function, and the reversed list moves back out.',
    10: '`curr` may be None. Matching Some opens it and moves the node out of `curr` into `node`.',
    11: '`take` moves the next node out and leaves None in its place. The node it took goes to `curr`.',
    13: '`node` moves into `prev`. `prev` is an Option, so the node is wrapped in Some.',
  },
};

export default en;
