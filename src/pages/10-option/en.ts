import type { PageEn } from '../../core/page.ts';

const en: PageEn = {
  kicker: 'No null · Rust Book ch. 6',
  title: '`null` and `Option<T>`',
  lead: [
    'JS uses `null` and `undefined` for "no value", but the variable looks the same as one that has a value. Forget the check, and you get a TypeError only when that line runs.',
    'Rust has no `null`. A value that may be missing goes in a box called Option: Some holds a value, None is an empty box. The box is not the value, and you cannot reach the value without opening the box.',
  ],
  captions: [
    {
      js: '`words` points to an array with a single element.',
      rust: 'No matching line on this side.',
    },
    {
      js: '`a` gets `words[0]`, which is "hi".',
      rust: '`a` holds a box with "hi" inside: Some.',
    },
    {
      js: '`b` points to an empty slot. Its line looks the same as the one from `a`.',
      rust: '`b` holds an empty box: None. The type says a value may be missing.',
    },
    {
      js: 'No box to open on this side.',
      rust: 'Open the box in `a`: there is a value, and it moves to `text`.',
    },
    {
      js: 'Follow the line from `a` to the value and print HI.',
      rust: '`text` holds the value now. Print HI.',
    },
    {
      js: 'No matching line on this side.',
      rust: '`text` goes out of scope, and "hi" is dropped.',
    },
    {
      js: 'No box to open on this side.',
      rust: 'Open the box in `b`: it is empty, so the block is skipped.',
    },
    {
      js: 'Only when the code touches the empty slot does it throw: TypeError.',
      rust: 'The block for the empty box never ran. Nothing goes wrong.',
    },
    {
      js: 'The program has already stopped.',
      rust: '`main` ends, and both boxes are dropped.',
    },
  ],
  breakIt: {
    hint: 'Break it: use `b` without opening the box',
    plain:
      '`b` is an `Option<String>`, not a String. The box has no `to_uppercase` method. You have to open it and confirm there is a value inside before you can use that value.',
  },
};

export default en;
