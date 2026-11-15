import type { PageEn } from '../../core/page.ts';

const en: PageEn = {
  kicker: 'Ownership · Rust Book ch. 4',
  title: 'Passing to a function, returning from one',
  lead: [
    'In JS, passing an array or object to a function gives the parameter one more line to the same value. After the function returns, the outer variable can still use it.',
    'In Rust, passing a value works like assignment: it moves into the parameter, and the original variable becomes an empty shell. A value the function does not return is dropped. Returning moves it back to the caller.',
  ],
  captions: [
    {
      js: 'An orb floats in the air; variable `a` points to it.',
      rust: 'The claw `a` holds the crystal.',
    },
    {
      js: 'The parameter `s` adds a second line to the same orb.',
      rust: 'The crystal moves into the function, to the parameter `s`; `a` is an empty shell.',
    },
    {
      js: 'The same orb comes back, and `b` points to it; the line from `s` is cut.',
      rust: 'Returning moves the crystal back to the caller, where `b` holds it.',
    },
    {
      js: 'One more line: `a`, `b`, and `s` all point to the same orb.',
      rust: 'The crystal moves again, into the parameter `s` of `show`; `b` is an empty shell too.',
    },
    {
      js: 'Inside the function, the line from `s` reaches the orb.',
      rust: '`s` holds the value, so using it inside the function is fine.',
    },
    {
      js: 'The function ends and one line is cut; `a` and `b` still point to the orb.',
      rust: 'The function ends without returning the value, so it is dropped along with `s`.',
    },
    {
      js: 'All lines are cut. The orb waits for the GC.',
      rust: '`a` and `b` have long been empty shells, so there is nothing left to drop.',
    },
  ],
  breakIt: {
    hint: 'Break it: use `a` after passing it to a function',
    plain:
      'The value moved out of `a` the moment it went into `pass`, leaving an empty shell. The function does return the value, but `b` receives it, not `a`.',
  },
};

export default en;
