import type { PageEn } from '../../core/page.ts';

const en: PageEn = {
  kicker: 'Error handling · Rust Book ch. 9',
  title: '`throw` and `Result<T, E>`',
  lead: [
    'When a JS function fails, it throws, and the error travels up the call stack until something catches it. The types do not say a function can throw, and nothing reminds the caller to catch.',
    'Rust has no exceptions. A function that can fail returns a box called Result: Ok holds the result, Err holds the error. The caller has to open the box and handle both cases to get the value.',
  ],
  captions: [
    {
      js: '`main` calls `parse`. The call stack is two frames deep.',
      rust: 'Call `parse` to try to turn "abc" into an integer.',
    },
    {
      js: '"abc" is not valid JSON, so `parse` throws an error.',
      rust: 'No matching line on this side.',
    },
    {
      js: 'The lightning passes through `parse` on its way up. `n` is never assigned.',
      rust: '`parse` returns a two-colored box. This time it is Err, and `result` holds it.',
    },
    {
      js: '`main` has no try/catch, so the error keeps going up.',
      rust: '`match` opens the box to see whether it is Ok or Err.',
    },
    {
      js: 'This line never runs.',
      rust: 'Not Ok. This arm is skipped.',
    },
    {
      js: 'Nothing catches the error, and the whole program stops.',
      rust: 'It is Err. The error moves to `e`, and the message is printed.',
    },
    {
      js: 'The program has already stopped.',
      rust: 'The error is handled, and `main` ends normally.',
    },
  ],
  breakIt: {
    hint: 'Break it: add 1 without opening the box',
    plain:
      '`result` is a `Result<i32, ParseIntError>`, not an `i32`. You cannot add 1 to a box. You get the number only after you open the box and handle both Ok and Err.',
  },
};

export default en;
