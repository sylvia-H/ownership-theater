import type { PageEn } from '../../core/page.ts';

const en: PageEn = {
  kicker: 'No null · Rust Book ch. 6',
  title: '`match` must cover every case',
  lead: [
    'A JS `switch` runs only the cases you wrote. Leave one out and nothing complains: at run time the value slips past every case, and the code after the `switch` gets `undefined`.',
    'A Rust `match` must be exhaustive. Leave out an arm and the compiler names the case you missed and refuses to compile, so you find out before the program ever runs.',
  ],
  captions: [
    {
      js: 'Comparing 5 with 5 gives 0, and `order` gets it.',
      rust: 'Comparing 5 with 5 gives Equal, and `order` holds it.',
    },
    {
      js: '`text` is declared without a value, so it points to an empty slot.',
      rust: 'No matching line on this side.',
    },
    {
      js: 'The `switch` has only two gates: -1 and 1.',
      rust: 'The `match` has three gates, one for each possible value.',
    },
    {
      js: 'Not -1. Move on.',
      rust: 'Not Less. Move on.',
    },
    {
      js: 'Not 1. Move on.',
      rust: 'It is Equal, so the value goes through this gate.',
    },
    {
      js: 'No gate takes 0, so the value slips past them all.',
      rust: 'The `match` evaluates to "same", and `text` holds it.',
    },
    {
      js: 'Print `undefined`. No error anywhere.',
      rust: 'Print "same".',
    },
    {
      js: '`main` ends.',
      rust: '`main` ends.',
    },
  ],
  breakIt: {
    hint: 'Break it: delete the Equal arm',
    plain:
      'The `match` no longer covers Equal. Rust names the missing case at compile time, instead of letting the value slip past every arm at run time.',
  },
};

export default en;
