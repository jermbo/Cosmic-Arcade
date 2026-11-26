# Wordkin architecture

Three word puzzles on one shared core. Plain TypeScript and DOM, no engine. Content is data.

## Folders

| Path | What it holds |
| ---- | ------------- |
| `src/data/groups.json` | The group bank: `id`, `level` (1 easy to 4 sneaky), `theme`, 5 to 8 `words`. |
| `src/data/puzzles.json` | Hand-made puzzles (empty for now). See below. |
| `src/data/dict.txt` | Words a guess may be. Made by `npm run dict` from the system word list. |
| `src/data/extra-words.txt` | Modern words the old list lacks. Add one per line. |
| `src/core/` | Pure logic: types, seeded random, the bank, the puzzle builder, guess scoring, `tuning.ts`. |
| `src/ui/` | Parts every mode uses: sorting board, guess rows, keyboard, guess panel, header, modals, Kip, effects. |
| `src/modes/` | One file per mode (`crack.ts`, `secret.ts`, `link.ts`), plus names and help text in `meta.ts`. |
| `src/app.ts` | The flow: title, game, results. |
| `src/audio.ts` | All sound, made with Web Audio nodes. |
| `src/save.ts` | Settings, daily results and stats in localStorage. |

## Puzzles

`core/builder.ts` picks one group per level, then 4 words from each. A word that is listed in two groups on the same board is never used, so every board has one answer. A daily puzzle uses `mode|date` as its seed, so everyone gets the same one that day. Practice uses a random seed.

- **Crack** locks one 4 to 6 letter word per group.
- **Secret** picks a 6 to 8 letter word from an easy or medium group that is not on the board. Its theme is the clue.
- **Link** uses the 4 groups as 4 rounds. Each round gets 3 decoy themes near its level.

## Add content

- **A group:** add an entry to `groups.json`. Run `npm test -w wordkin`. It checks the bank and builds 1200 puzzles.
- **A hand-made puzzle:** add to `puzzles.json`:
  `{ "id": "nov-26", "date": "2026-11-26", "mode": "crack", "groups": [{ "theme": "...", "level": 1, "words": ["A", "B", "C", "D"] }, ...] }`.
  Leave out `mode` to use it for all three modes. On that date it replaces the built daily.

## Difficulty

Easy, Medium and Hard live in `DIFFICULTY` in `src/core/tuning.ts`. Each one sets the bank levels of the 4 groups, whether guesses must be real words, and per mode: hearts, guesses or tries, letters given at the start, the Secret clue (free, paid, none) and the number of Link choices. A board colors its groups by place (easiest first), not by bank level. Each difficulty has its own daily puzzle.

## Kin Book, Ask Kip, daily chain

- **Kin Book** (`src/book.ts`, `src/data/sets.json`, `src/ui/bookview.ts`): each bank group you solve yourself is a sticker. Each set in `sets.json` gives Kip a hat (`src/ui/hats.ts`) when full. A new group must go in one set; the test checks this.
- **Ask Kip**: tap Kip in the header. In a guess panel or Link, Kip shows one letter. On a board, Kip marks two words of one group with the same number (or adds one more). Hints per game are `hints` in `DIFFICULTY`, the cost is `TUNING.hintCost`.
- **Daily chain** (`src/core/chain.ts`, `src/ui/chainview.ts`): a 6 letter word per day and difficulty. Each daily you win shows 2 of its letters. After all 3 dailies are played, you get 4 tries. Its streak is separate.

## Coins, shop, Endless Run, Blitz

- **All the numbers** for coins, Endless Run and Blitz are in `src/core/economy.ts` (`EARN`, `RUN`, `BLITZ`).
- **Shop items and prices** are in `src/shop/catalog.ts`. The first item of each section is free. Add an item there, then give it a look:
  - theme: a `[data-theme='id']` block of color tokens in `style.css`;
  - tile style: `[data-tiles='id']` rules in `style.css`;
  - sound: an entry in `PACKS` in `src/audio.ts`;
  - motion: an entry in `MOTION_FEEL` in `catalog.ts`.
- `src/shop/wallet.ts` holds coins, buying, and `applyLooks()`, which puts the chosen looks on `<html>`.
- **Endless Run** lives in `src/app.ts` (`playRun`): it runs the normal modes with carried-over hearts (`ctx.hearts`).
- **Blitz** is `src/modes/blitz.ts`.

## Offline (PWA)

`vite.config.ts` writes `sw.js` at build time with every built file, so the game (and the word list) plays offline. `public/manifest.webmanifest` and `public/icons/` make it installable; the title shows **Install** when the browser offers it. Redraw the icons with `npm run icons -w wordkin`. Add `?dev` to a build URL to turn the service worker off.

## Tune

Points, the combo bonus and the score scale per difficulty are in `TUNING` in `src/core/tuning.ts`.
