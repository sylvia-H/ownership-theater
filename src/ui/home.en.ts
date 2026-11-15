// English content for the home page. The Chinese counterpart is home.zh.ts, which has the same shape
// (it is typed as HomeText, exported at the end of this file).
//
// Field <-> where it appears in Home.tsx (and in intro.ts / sections.ts, which Home.tsx reads)
//
// Opening, <Intro>
//   hero.title            <h1 id="home-title">
//   hero.lede             <p class="home-lede">
//   hero.cta              <a class="home-cta"> (link to the first act)
//   hero.more             <button class="home-more"> (scrolls to the index)
//   hero.replay           <button class="home-replay">
//   intro.valueLabel      intro.ts: the label of the two alloc events (the tag next to the value on stage)
//   intro.captions[i]     intro.ts: the caption of step i of the trace buildIntroTrace returns, one js and one
//                         rust line. Backticks mark inline code (src/ui/inline.ts).
//                         The "JS" and "Rust" tags in front of the captions are the same in both languages.
//
// The three explanations, <Explain>
//   why.heading           <h2 id="home-why">
//   why.paragraphs[0..2]  the three <p> in the .home-text below it, in order
//   read.heading          <h2 id="home-read">
//   read.js.heading       <h3> inside .home-world-js
//   read.js.items         the three <li> of the JS world, keyed by the icon class of the row
//                         (g-orb -> orb, g-link -> link, g-stray -> stray)
//   read.rust.heading     <h3> inside .home-world-rust
//   read.rust.items       the five <li> of the Rust world, keyed the same way
//                         (g-held, g-husk, g-shards, g-beam, g-field)
//   core.heading          <h2 id="home-core">
//   core.rules[0..2]      the three <li> of <ol class="home-rules">, in order
//   core.point            <p class="home-point">, the closing sentence
//
// Section index, <Index>
//   index.heading         <h2 id="home-index">
//   index.note(total, open)  first sentence of <p class="home-index-note">:
//                         total = totalCount, open = pages.length
//   index.noteLc(count)   second sentence of the same <p>: count = problems.length.
//                         Shown only when problems.length > 0.
//   index.noteJoin        what goes between note and noteLc: one space in English, nothing in Chinese
//   index.tabsLabel       aria-label of the role="tablist" element
//   index.random          <button class="home-random">
//   index.pending         .home-card-state and .home-empty (the same word in both places)
//
// Section names and subtitles
//   sections[id].name     the name of each section (the text on the tab), keyed by the section id in sections.ts
//   sections[id].sub      the subtitle of the same section (<p class="home-panel-sub">)
//   sections.lc           the LeetCode tab (lcSection in sections.ts; its id is 'lc')
//
// Not in this file: act titles (src/pages/titles.en.ts) and LeetCode card teasers (src/lc/teasers.en.ts).

export const HOME_EN = {
  hero: {
    title: 'Ownership Theater',
    lede: 'The same line of code. A different fate for the value in JS and in Rust.',
    cta: 'Start with act one',
    more: 'See all acts',
    replay: 'Replay',
  },

  intro: {
    valueLabel: 'value',
    captions: [
      {
        js: 'A value floats in the air, and `a` points to it',
        rust: 'The claw `a` holds the value',
      },
      {
        js: '`b` adds a second line to the same value',
        rust: 'The whole value moves to `b`; `a` is an empty shell',
      },
    ],
  },

  why: {
    heading: 'Why a theater',
    paragraphs: [
      'Each page is a short act, and the actors are values. The stage is split into a left half and a right half, and the same code plays once in JS and once in Rust.',
      'Drag the timeline forward or backward to see what happens to each value at every step. Each act also has a Break it action that shows how the Rust compiler stops the code.',
      'Ownership is the subject of the show: in Rust, every value has exactly one owner at a time.',
    ],
  },

  read: {
    heading: 'How to read the two worlds',
    js: {
      heading: 'The JS world',
      items: {
        orb: 'A value is an orb floating in the air.',
        link: 'A variable is a line connected to it. Many lines can connect to the same orb.',
        stray: 'An orb with no line left keeps floating and waits for the garbage collector (GC).',
      },
    },
    rust: {
      heading: 'The Rust world',
      items: {
        held: 'A value is a crystal held by a claw. Each value is held by exactly one claw.',
        husk: 'Assignment moves the whole crystal. The claw it left becomes an empty shell.',
        shards: 'The moment its owner goes out of scope, the value is dropped on the spot: the crystal shatters.',
        beam: 'A borrow is a beam: many read-only beams, or exactly one that can write.',
        field: 'A violation bounces off a force field, which shows the rustc error message verbatim.',
      },
    },
  },

  core: {
    heading: 'The core of Rust',
    rules: [
      'Every value has exactly one owner.',
      'You can borrow, and the rules are checked at compile time: at any moment, many readers or one writer, never both.',
      'When the owner goes out of scope, the value is dropped on the spot. So there is no GC, and no reference to freed memory.',
    ],
    point:
      'The two languages do not differ in what is possible. They differ in what is the default: JS shares by default and anyone can mutate; Rust is exclusive by default, and you have to say so when you want sharing or mutation.',
  },

  index: {
    heading: 'All acts',
    /** total: number of acts in all (totalCount); open: number of acts available (pages.length). */
    note: (total: number, open: number): string =>
      `${total} ${total === 1 ? 'act' : 'acts'}, in the order of the Rust Book; ${open} ${open === 1 ? 'is' : 'are'} open.`,
    /** count: number of LeetCode problems (problems.length). */
    noteLc: (count: number): string =>
      `Plus ${count} LeetCode ${count === 1 ? 'problem' : 'problems'} compared side by side.`,
    /** What goes between note and noteLc. */
    noteJoin: ' ',
    tabsLabel: 'Sections',
    random: 'Pick a random act',
    pending: 'In progress',
  },

  sections: {
    ownership: { name: 'Ownership', sub: 'Rust Book ch. 4' },
    borrowing: { name: 'Borrowing', sub: 'Rust Book ch. 4' },
    'no-null': { name: 'No null', sub: 'Rust Book ch. 6' },
    errors: { name: 'Error handling', sub: 'Rust Book ch. 9' },
    lifetimes: { name: 'Lifetimes', sub: 'Rust Book ch. 10' },
    iterators: { name: 'Iterators', sub: 'Rust Book ch. 13' },
    'smart-pointers': { name: 'Smart pointers', sub: 'Rust Book ch. 15' },
    lc: { name: 'LeetCode', sub: 'The same problem in TS and Rust, line by line' },
  },
};

export type HomeText = typeof HOME_EN;
