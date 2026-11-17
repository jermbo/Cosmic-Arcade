---
name: Buy and use Symbols, Dice pips and Silhouettes
description: "The shop gets a Block styles section with Patterns free and three styles for sale."
tags:
  - kerplunk
persona: the player
depends-on:
  - kerplunk-dark-theme.md
status: ready
---

[Wiki](../../../README.md) / [Kerplunk 2.0.0 stories](kerplunk-stories.md) / Buy and use Symbols, Dice pips and Silhouettes

# Buy and use Symbols, Dice pips and Silhouettes

As the player, I want to buy and pick a block style, so that the blocks look the way I like and I still tell the colors apart.

## Requirements

1. The shop has a Block styles section
   - a. Patterns: free, owned from the start
   - b. Symbols: ✦100
   - c. Dice pips: ✦100
   - d. Silhouettes: ✦150
   - e. Each item shows the five blocks in that style, its price or "Owned", and "Use" or "In use"
2. Buy and use work as for themes; the save holds the owned styles and the active style
3. A block style works with each theme
4. Symbols: a solid shape in black or white, whichever has more contrast on the block
   - a. Ember triangle, Amber circle, Moss diamond, Tide square, Dusk plus
5. Dice pips: dots in black or white as in 4
   - a. Ember 1, Amber 2, Moss 3, Tide 4, Dusk 5
6. Silhouettes: the outline of the block itself, with no mark in it
   - a. Ember square, Amber circle, Moss leaf (two round corners), Tide octagon, Dusk arch
7. The well, the tray, How to play and the shape lab show the active style

## Acceptance criteria

1. GIVEN 342 Glints WHEN the player buys Silhouettes THEN the wallet shows 192 Glints
2. GIVEN Dice pips is in use WHEN the player looks at a Dusk block THEN it shows 5 dots
3. GIVEN Silhouettes is in use WHEN the player looks at an Amber block THEN it is a circle
4. GIVEN Symbols is in use and the Dark theme is in use WHEN the player looks at the well THEN each block shows its symbol
5. GIVEN the grayscale filter of the phone is on WHEN each of the three styles is in use THEN the five colors look different

## Depends on

- [Buy and use the Dark theme](kerplunk-dark-theme.md): it makes the shop items for owning and picking a look.

## Architecture

- [Spec, scope 5 b and 5 d](../../../initiatives/kerplunk/v2/spec.md)
- [Decision log, D4](../../../initiatives/kerplunk/v2/decision-log.md)
