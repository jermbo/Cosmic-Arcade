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

- **A group:** add an entry to `groups.json`. Run `npm test -w word-game`. It checks the bank and builds 1200 puzzles.
- **A hand-made puzzle:** add to `puzzles.json`:
  `{ "id": "nov-26", "date": "2026-11-26", "mode": "crack", "groups": [{ "theme": "...", "level": 1, "words": ["A", "B", "C", "D"] }, ...] }`.
  Leave out `mode` to use it for all three modes. On that date it replaces the built daily.

## Tune

All numbers (hearts, guesses, tries, points, combo) are in `src/core/tuning.ts`.
