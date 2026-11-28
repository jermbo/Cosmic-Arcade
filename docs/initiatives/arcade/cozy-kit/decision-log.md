---
name: Cozy kit decisions
description: "The decision log of the cozy kit: each question, the options, the choice and the reason."
altitude: initiative
tags:
  - arcade
parent: README.md
---

[Wiki](../../../README.md) / [Cozy kit](README.md) / Decisions

# Cozy kit decisions

## D1. One family: cozy puzzle daily games

**Date:** 2026-11-27

**Question:** Should Mozzi, Wordkin, Kerplunk and Hueway share one theme and palette?

**Options:** Keep a look per game, or share one look.

**Choice:** Share one look, and call the family "cozy puzzle daily games".

**Reason:** The owner has made several of these games and wants to be consistent from now on, with the styles already filled out for the next one.

## D2. Both looks, as a free setting

**Date:** 2026-11-27

**Question:** Soft clay (Mozzi, Hueway) or neo-brutalist (Wordkin, Kerplunk)? And how does a player choose?

**Options:** Soft clay for all; neo-brutalist for all; a shared palette with each game keeping its own shape. Then: a free setting, or a shop item.

**Choice:** Both, as two styles of one kit: Soft and Bold. A free Style setting in every game, Soft by default.

**Reason:** The owner usually likes neo-brutalist, but thinks soft clay looks best for these games. A setting keeps both.

## D3. All four games in one pass

**Date:** 2026-11-27

**Question:** Move Hueway first, then the others one at a time, or all four now?

**Options:** Kit and Hueway first; all four now.

**Choice:** All four now.

**Reason:** The owner's choice.

## D4. The kit is plain JS and CSS

**Date:** 2026-11-27

**Question:** What form does the kit take?

**Options:** TypeScript or React parts; plain JS data plus CSS.

**Choice:** Plain JS data (`themes.js`) with types, CSS made from it (`kit.css`), fonts, and shared CSS parts. Kerplunk keeps a copy, made by `tools/copy-kit.js`.

**Reason:** Kerplunk has no bundler and draws on a canvas, so it needs the colors as data and files it can copy. The React games read the same files.

## D5. One palette per tone, safe for color blindness

**Date:** 2026-11-27

**Question:** Each game had its own tile and line colors. Which colors does the kit use?

**Options:** Keep each game's colors; one shared palette.

**Choice:** One palette of 10 colors per tone. The first five (red, blue, yellow, green, purple) are tuned to stay apart under the three common kinds of color blindness (ΔE 18 or more, checked on every build). Games with four or five colors use those five.

**Reason:** Mozzi had already tuned its four colors this way. The kit makes it true for every game, and the check keeps it true.
