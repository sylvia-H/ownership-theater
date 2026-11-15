// 首頁的中文文字。欄位與 home.en.ts 一一對應（型別是同一個 HomeText，少一欄型別檢查就不會過）；
// 每一欄出現在 Home.tsx 的哪裡，見 home.en.ts 開頭的對照。

import type { HomeText } from './home.en.ts';

export const HOME_ZH: HomeText = {
  hero: {
    title: '所有權劇場',
    lede: '同一行程式，值在 JS 與 Rust 的命運不一樣。',
    cta: '從第一齣開始',
    more: '看全部場次',
    replay: '重播',
  },

  intro: {
    valueLabel: '值',
    captions: [
      {
        js: '一顆值漂在空中，a 連一條線過去',
        rust: 'a 這隻夾具握住這顆值',
      },
      {
        js: 'b 多連一條線到同一顆值',
        rust: '值整顆搬到 b，a 變成空殼',
      },
    ],
  },

  why: {
    heading: '為什麼叫「劇場」',
    paragraphs: [
      '每一頁是一齣短劇，演員是「值」。舞台分成左右兩半，同一段程式在 JS 與 Rust 各演一次。',
      '拖時間軸可以前進、後退，看值在每一步的下場。每頁還有一個「弄壞它」的動作，看 Rust 的編譯器怎麼把它擋下來。',
      '「所有權」是這齣戲的主題：在 Rust，每個值同一時間只有一個擁有者。',
    ],
  },

  read: {
    heading: '兩個世界怎麼讀',
    js: {
      heading: 'JS 世界',
      items: {
        orb: '值是漂在空中的光球。',
        link: '變數是連到它的線，很多條線可以連同一顆。',
        stray: '沒有線連著的球繼續漂，等 GC 經過才收走。',
      },
    },
    rust: {
      heading: 'Rust 世界',
      items: {
        held: '值是被夾具握著的晶體，一個值只被一隻夾具握著。',
        husk: '指定是整顆搬走，原本的夾具變成空殼。',
        shards: '離開範圍的那一刻，值當場碎掉。',
        beam: '借用是一道光束：可以有很多道只讀的，或唯一一道可改的。',
        field: '違規會被力場彈開，上面是 rustc 的錯誤訊息原文。',
      },
    },
  },

  core: {
    heading: 'Rust 的核心精神',
    rules: [
      '每個值只有一個擁有者。',
      '可以借，但規則在編譯期就檢查：同一時間，要嘛很多人讀，要嘛只有一個人改。',
      '擁有者離開範圍，值立刻釋放。所以不需要 GC，也不會有指向已釋放記憶體的參考。',
    ],
    point: '兩邊的差別不是「有沒有」，是「預設」：JS 預設共享、誰都能改；Rust 預設獨占，要共享、要可改都得明講。',
  },

  index: {
    heading: '全部場次',
    note: (total, open) => `共 ${total} 齣，照 Rust Book 的順序排；已開放 ${open} 齣。`,
    noteLc: (count) => `另有 LeetCode 對照 ${count} 題。`,
    noteJoin: '',
    tabsLabel: '分區',
    random: '隨機看一齣',
    pending: '製作中',
  },

  sections: {
    ownership: { name: '所有權', sub: 'Rust Book 第 4 章' },
    borrowing: { name: '借用', sub: 'Rust Book 第 4 章' },
    'no-null': { name: '沒有 null', sub: 'Rust Book 第 6 章' },
    errors: { name: '錯誤處理', sub: 'Rust Book 第 9 章' },
    lifetimes: { name: '生命週期', sub: 'Rust Book 第 10 章' },
    iterators: { name: '迭代器', sub: 'Rust Book 第 13 章' },
    'smart-pointers': { name: '智慧指標與收尾', sub: 'Rust Book 第 15 章' },
    lc: { name: 'LeetCode 對照', sub: '同一題，TS 與 Rust 逐行並排' },
  },
};
