---
name: Mozzi v2
description: "The plan to give Sudoglue a soft, clean look, a phone-first layout, and a shop of themes, tile styles and sound packs."
altitude: initiative
tags:
  - mozzi
---

[Wiki](../../../README.md) / Mozzi v2

# Mozzi v2

Mozzi (`games/mozzi`) started as Sudoglue 1.0. It plays well, but its neo-brutalist stained-glass look, its number and color controls, and its sound did not land. Version 2 changes the look and the layout, and adds a reason to come back. The [decision log](decision-log.md) records each choice and the reason for it.

## Goals

1. **A soft, clean look.** Puffy "clay" tiles, calm colors, patterns so that color is never the only clue.
2. **A phone-first layout.** The board on top, the number and color rows at the bottom, in reach of the thumb.
3. **Things to collect.** Coins from each window buy themes, tile styles and sound packs.
4. **Polish.** Micro animations, accessibility, and softer, more musical sound.

## What changes

- The play screen uses layout C ("thumb zone"): tools in the top bar, the board, then a numbers row and a colors row.
- The pair chart goes away. The color row shows used pairs for the picked tile; a Pairs sheet shows all 16.
- A hint opens as a sheet in place of the two rows. The board shrinks but stays in view.
- A shop sells 6 themes (3 light, 3 dark), 4 tile styles and 3 sound packs. All items are data in `src/app/shop.ts`.
- Coins: a base per level, plus bonuses for no hints, a new best time, and the daily streak. Hints cost nothing.
- The game is renamed Mozzi, and Mozzi (four tiles with a face) is the mascot and the hint giver.
