---
name: Kerplunk v2 decisions
description: "The decision log of Kerplunk v2: each question, the options, the choice and the reason."
altitude: initiative
tags:
  - kerplunk
parent: README.md
---

[Wiki](../../../README.md) / [Kerplunk v2](README.md) / Decisions

# Kerplunk v2 decisions

## D1. Fewer shapes, and refill only after both pieces are used

**Date:** 2026-11-17

**Question:** Why is the game too easy?

**Choice:** Cut the shape list to about 14, with a few fun shapes, and refill the tray only when both pieces are used.

**Reason:** With 28 shapes and a slot that refills at once, the player can wait for the right piece. When the player must also place the piece they do not want, a good move needs a plan.

## D2. Shelve the daily challenge

**Date:** 2026-11-17

**Question:** What makes the daily challenge worth playing?

**Choice:** Nothing yet. Hide it, and come back to it as a puzzle mode.

**Reason:** It is a normal run with extra Glints. Missions give a daily reason to play in its place.

## D3. The visual direction is neo-brutalist

**Date:** 2026-11-17

**Question:** Which look should Kerplunk have?

**Options:** A prototype showed three rounds of options on the real game screen:

1. Loud: Neon cabinet, Paper cut, Orbit, Toy box.
2. Quiet: Porcelain, Graphite, Frost, Swiss.
3. Neo-brutalist: Light, Dark, Random.

**Choice:** Neo-brutalist, with all three themes. Light is free. Dark and Random are unlocks.

**Reason:** The loud set felt forced. The quiet set looked designed but had no character. The neo-brutalist look has both, and its thick outlines keep the high contrast. Random gives a bought theme a reason to exist: each game looks a little new.

## D4. Block styles: Patterns by default, four styles to unlock

**Date:** 2026-11-17

**Question:** What should the blocks look like? The small symbols took away from the design.

**Options:** Symbols, Patterns, Faces, Dice pips, Silhouettes. Each one gives each color a second clue for grayscale play.

**Choice:** Patterns is the free default. Symbols, Dice pips, Silhouettes and Faces are unlocks.

**Reason:** Patterns fit the neo-brutalist print look and fill the whole block, so they do not look like a small mark on top. The other styles are fun to collect.

## D5. No links between blocks

**Date:** 2026-11-17

**Question:** Should touching blocks of one color be joined, so that groups read at a glance?

**Options:** A small bridge between same-color neighbors, shown on each block style.

**Choice:** No links.

**Reason:** The bridges looked low-fidelity next to the rest of the design. If group reading becomes a problem in play-tests, try a better treatment then.

## D6. Timed mode: earn time, and power-ups apply themselves

**Date:** 2026-11-17

**Question:** How does Timed mode reward skill, and why does nobody use power-ups in it?

**Choice:**

- a. A chain or a big group adds seconds to the clock. The clock starts lower than today.
- b. In Timed, an earned power-up acts at once. Prism paints the pieces in the tray in the color that gives the best clear. Blast clears the area that helps most. Remix shuffles at once.
- c. Endless keeps power-ups that the player taps.

**Reason:** Tapping a power-up costs time, so in Timed it is a loss. Time as a reward makes a strong player play longer. In Endless there is time to think, so the choice stays with the player.

## D7. New saves, no conversion

**Date:** 2026-11-17

**Question:** What happens to the saves of today?

**Choice:** Bump the save version. Each player starts a new save: best scores, Glints and bought items start again. Old saves are not converted.

**Reason:** The new shapes, the refill rule and the new shop make old scores and old items not compare. This is the rule that the owner uses for the games of the arcade.

## D8. Themes and block styles replace the block skins

**Date:** 2026-11-17

**Question:** What does the shop sell for the look?

**Choice:** The shop sells themes (Dark, Random) and block styles (Symbols, Dice pips, Silhouettes, Faces). The block skins of today (Sunset, Ocean, Neon) go away. The prices are drafts: ✦100 to ✦300.

**Reason:** A theme and a block style are each a full look with character. A skin only changed five colors.

## D9. Come-back features: wanted, details open

**Date:** 2026-11-17

**Question:** What brings a player back for weeks?

**Choice:** The owner wants all four: a ramp in Endless, missions, run perks, and shapes to unlock. Their details are not decided: which ramp, which missions and rewards, which perks and when, which shapes and how they unlock.

**Reason:** Each one gives a goal past the next game. The details need their own grill before stories.

## D10. The game is called Kerplunk

**Date:** 2026-11-17

**Question:** The name Glintwell fits the old stained-glass look, not the neo-brutalist one. What is the new name?

**Options:** Many rounds of names. Bodega was the second pick.

**Choice:** Kerplunk. The arcade entry, the URL slug and the docs use `kerplunk` now. The game code renames in 2.0.0. The folder `games/block-drop/` keeps its name. Old links are not sent to the new URL, because the game is only for the owner now.

**Reason:** It is loud, funny, and sounds like a block that lands. It fits the neo-brutalist look.

## D11. The code folder is called kerplunk too

**Date:** 2026-11-17

**Question:** Does the folder `games/block-drop/` keep its name? D10 said yes.

**Choice:** No. The folder is `games/kerplunk/`, and the package is `kerplunk`. This replaces that part of D10.

**Reason:** The docs, the URL and the entry all use `kerplunk`. One name for one game is easier to remember than a mapping. No one plays it but the owner, so nothing breaks.

## D12. The logo is one long piece of game blocks

**Date:** 2026-11-17

**Question:** The title logo of today (eight loose letter tiles in flat colors) is dull. Which logo gives Kerplunk fun and character, reads as one word at a glance, and still feels like the game?

**Options:** Three rounds of variants on the title screen, at 375px.

- Round one: B, the name drawn in a pixel font of game cells, KER small over a big PLUNK. C, a comic sound word with a block that drops into the U. D, letter columns stuck under a ceiling. E, a small well emblem over a label strip.
- Round two, on B: B2, the cells drawn with the game's block art. B3, letters built from joined pieces. B4, the name cut out of a wall of blocks. B5, B that clears its own letters now and then. All were too hard to read, and KER over PLUNK did not read as one word.
- Round three, on one line: F, the pixel font of B2 on one line (too small). G, big bold letters filled with small blocks. H, one long piece. I, a big ink word that hangs under a row of blocks.

**Choice:** H, one long piece. The eight letters of KERPLUNK sit on eight game blocks in one straight row, the blocks touching, the row turned about 2 degrees counter-clockwise, with one hard shadow under the whole row.

- Each block is drawn by the game's own block drawing (`drawBlock` in `sprites.js`), in the theme and block style in use, so the logo changes with the shop. The colors run through the five block colors in order: K E R P L, then U N K start again.
- Each letter is the display font, white, with a thick ink outline drawn behind the fill, about two thirds of the block size, so it reads on any block style.
- The block size fits the screen: about 10.4% of the width, from 34px to 52px.
- Motion: the blocks drop in one after the other on load. A tap on a block makes it hop and play its note, as the tiles of today do.

**Reason:** It reads at once as one word, on a phone too. It looks like a piece from the game, with the real block art, so the logo shows the game and changes with what the player buys. The pixel-font variants had more character but cost too much to read.
