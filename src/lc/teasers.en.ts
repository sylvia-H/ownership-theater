// English teasers for the LeetCode cards on the home page, keyed by slug (src/lc/index.ts).
// The home page does not load the problems themselves, so the teasers are repeated here.
// Each one must equal the `teaser` in that problem's en.ts; src/i18n.test.ts checks it.

export const TEASERS_EN: Record<string, string> = {
  'two-sum': 'The baseline: the same algorithm, plus a few extra symbols.',
  'reverse-string': 'In-place mutation: you need a `&mut` borrow before you can write.',
  'group-anagrams': 'Strings are moved into the map, not copied.',
  'reverse-linked-list': 'Every step has to say who owns the node now.',
  'invert-binary-tree': 'Shared and mutable: in Rust, both go in the type.',
};
