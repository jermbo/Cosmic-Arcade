---
name: Cozy kit
description: "One shared look for the arcade's cozy puzzle games: shared themes, and two styles (Soft and Bold) as a free setting."
altitude: initiative
tags:
  - arcade
  - mozzi
  - hueway
  - wordkin
  - kerplunk
---

[Wiki](../../../README.md) / Cozy kit

# Cozy kit

The arcade has a family of **cozy puzzle games**: Mozzi, Hueway, Wordkin and Kerplunk. They used two looks (soft clay, and neo-brutalist) with their own colors and fonts. The cozy kit (`games/cozy-kit`) gives them one shared look, so a new game in the family starts with its styles already done. The [decision log](decision-log.md) records each choice and the reason for it.

## Goals

1. **Consistent.** The same themes, palette, fonts and parts in every cozy game.
2. **Both looks.** Soft clay and neo-brutalist are both kept, as a free **Style** setting. Soft is the default.
3. **Ready for the next game.** A new cozy game gets the themes, fonts and shared parts by adding one package.
4. **Readable for everyone.** The kit checks that the first five palette colors stay apart for color-blind players, and that text has enough contrast in every theme.

## What changed

- New package `games/cozy-kit` (see its README): 7 themes, 2 styles, fonts, shared parts, and a color check.
- Every game has a **Style** setting (Soft / Bold) and sells the kit's 7 themes. Oat and Plum are free everywhere.
- Old theme ids load as the new ones (for example Mozzi's Linen is Oat, Wordkin's Dusk is Plum, Kerplunk's Light is Oat).
- Mozzi's color check moved into the kit. Wordkin's contrast check and Kerplunk's theme test now use the kit's colors.
- Kerplunk copies the kit into `src/kit/` (it has no bundler) and is now version 2.1.0.

## Each game keeps its own pieces

The kit owns the colors and the shape. Each game keeps what makes it itself: Mozzi's tile styles, Wordkin's tile styles and motion, Kerplunk's block styles, Random theme and canvas, and Hueway's line and dot styles.
