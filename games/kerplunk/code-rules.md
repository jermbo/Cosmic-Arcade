---
title: Kerplunk code rules
summary: "The code rules of the Kerplunk project. The goal: code that a person can read to learn how the game works."
updated: 2026-11-20
---

# Kerplunk code rules

These rules are for the files in `games/kerplunk/`. They win over `docs/standards/code-rules.md` and over the baseline for this project. Each rule that this page does not name stays as those pages tell it.

The goal of every rule: a person who reads the code can learn how the game works.

## One job for each file

- A file does one job, and its name says what the job is: `scoring.js`, `power-bar.js`, `game-over-screen.js`.
- A file starts with a short comment that tells its job.
- A file that grows past about 300 lines likely does two jobs. Split it.
- A file goes in the folder of its job (see "The code" in the README). The rules in `rules/` have no page code, so they also run in Node.

## Clear names

- A name says what a thing is: `game`, `block`, `visual`, `cell`, `piece`. Do not use one-letter names (`g`, `b`, `v`, `c`).
- One-letter names are fine only for a loop counter (`i`), for x and y, and for the short math names `w` (width) and `h` (height).
- A function name starts with a verb: `findGroups`, `drawTray`, `showGameOver`.
- A true-or-false value reads like a question: `isAllClear`, `canAfford`, `hasMove`.
- A number with a meaning gets a named constant at the top of the file, with a comment: `const DRAG_START_PX = 9; // a touch must move this far to count as a drag`.
- A thing has one name everywhere. If the player sees another name, a comment says so once (the code says "glints"; the player sees "Plunks").

## Simple functions

- A function does one thing. When a function needs a comment in the middle to explain a part, that part can be its own function.
- Use early returns, not deep nesting: test for the cases that stop the function first, and return.
- A function that only reads the game and gives an answer does not change the game.

## Comments

- A comment tells why, or what a thing is. It does not repeat the code.
- An exported function gets a short `/** ... */` comment.

## Behavior

- A rewrite for readability does not change how the game plays. Check it with `npm test` and `npm run sim` before and after.
- The tests in `tools/` import straight from the module under test in `src/js/` (for example `rules/game.js`, `shop/wallet.js`). See the README folder map.
