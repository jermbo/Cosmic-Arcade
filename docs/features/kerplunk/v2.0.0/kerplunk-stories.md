---
name: Kerplunk 2.0.0 stories
description: "The stories of Kerplunk 2.0.0, who they are for, what each one needs first, and the steps of the work."
tags:
  - kerplunk
---

[Wiki](../../../README.md) / Kerplunk 2.0.0 stories

# Kerplunk 2.0.0 stories

The scope and the decisions are in the [spec](../../../initiatives/kerplunk/v2/spec.md) and the [decision log](../../../initiatives/kerplunk/v2/decision-log.md). Each story is for the player.

## Stories

| # | Story | Depends on | Status |
| - | ----- | ---------- | ------ |
| 1 | [Name the game Kerplunk](kerplunk-name-the-game.md) | None | ready |
| 2 | [Fewer, more fun shapes](kerplunk-fewer-shapes.md) | None | ready |
| 3 | [Use both pieces before a refill](kerplunk-use-both-pieces.md) | None | ready |
| 4 | [The neo-brutalist game screen](kerplunk-game-screen-look.md) | None | ready |
| 5 | [Hide the daily challenge](kerplunk-hide-daily.md) | None | ready |
| 6 | [Timed: earn time](kerplunk-timed-earn-time.md) | None | ready |
| 7 | [Timed: power-ups act at once](kerplunk-timed-auto-power-ups.md) | None | ready |
| 8 | [The neo-brutalist look on every other screen](kerplunk-other-screens-look.md) | 4 | ready |
| 9 | [Buy and use the Dark theme](kerplunk-dark-theme.md) | 8 | ready |
| 10 | [The Random theme](kerplunk-random-theme.md) | 9 | ready |
| 11 | [Buy and use Symbols, Dice pips and Silhouettes](kerplunk-block-styles.md) | 9 | ready |
| 12 | [Buy and use Faces](kerplunk-faces.md) | 11 | ready |
| 13 | [Rename the currency](kerplunk-rename-currency.md) | None | needs-info |

## Steps of the work

The stories of one step can be built at the same time.

1. Stories 1, 2, 3, 4, 5, 6 and 7
2. Story 8
3. Story 9
4. Stories 10 and 11
5. Story 12

Story 13 waits for a name.

## Notes for the builder

- Stories 2 and 3 change the difficulty. Run `npm run sim` before and after each, and keep the numbers for the owner.
- Stories 3, 6 and 7 all change the engine. When two of them are built at the same time, expect to merge in the engine.
- The prices and the Timed seconds are drafts (spec scope 6 b and 8 b). Keep them as constants in one place each.
