---
name: Hueway v1 decisions
description: "The decision log of Hueway v1: each question, the options, the choice and the reason."
altitude: initiative
tags:
  - hueway
parent: README.md
---

[Wiki](../../../README.md) / [Hueway v1](README.md) / Decisions

# Hueway v1 decisions

## D1. The name is Hueway

**Date:** 2026-11-27

**Question:** What is the game called?

**Options:** Threadline, Hueway, Linkly, Pipe Dream, Kinship, Strand.

**Choice:** Hueway.

**Reason:** The owner liked it the most.

## D2. Build the main game first

**Date:** 2026-11-27

**Question:** Which twists go into 1.0?

**Options:** Bridges, color mixing, ink limits, one-way squares, a moving grid, lamps, three-dot colors, or none yet.

**Choice:** None yet. Build the main game first. The planned twist is an endless run.

**Reason:** The owner wants to see how the game is made first. The form of the endless run is not decided yet.

## D3. Modes like Mozzi and Wordkin

**Date:** 2026-11-27

**Question:** Which modes does 1.0 have?

**Options:** Daily only, or daily plus practice.

**Choice:** Today (it grows from 5×5 on Monday to 9×9 on Sunday), This week, and Practice at any size.

**Reason:** The owner asked for daily puzzles that start easy and get harder through the week, plus the option to play any puzzle.

## D4. A shop in 1.0, and a PWA

**Date:** 2026-11-27

**Question:** Does 1.0 have coins and a shop?

**Options:** Shop later, or shop in 1.0.

**Choice:** Shop in 1.0, with themes, line styles, dot styles and sound packs. It also installs and plays offline.

**Reason:** The owner asked for both.

## D5. The look is soft and cozy

**Date:** 2026-11-27

**Question:** Which look should Hueway have?

**Options:** Soft and cozy (clay, rounded, like Mozzi), or neo-brutalist (bold outlines, flat color, hard shadows).

**Choice:** Soft and cozy.

**Reason:** A calm look suits a relaxing puzzle.

## D6. Lines never touch themselves

**Date:** 2026-11-27

**Question:** What does "one answer" mean?

**Options:** Count every way to fill the board, or count only answers where no line runs alongside itself.

**Choice:** Only answers where no line touches itself. The game still accepts any full board as a win.

**Reason:** It makes the solver fast enough to check every puzzle on the device, and it matches how these puzzles are usually made. A player who finds another full answer still wins.

## D7. Endless is two modes: Clock run and Road trip

**Date:** 2026-11-27

**Question:** What should the Endless mode look like?

**Options:** A prototype in the game showed four playable versions:

- A, Clock run: a clock counts down, each solved board adds time, and the boards grow. The score is the number of boards solved.
- B, Road trip: one red line is the road. It comes in on the left edge and leaves on the right, and the next board starts where it left. A map shows the whole road. No clock.
- C, Rising river: one tall board drifts up, and a piece that reaches the top line before it is solved ends the run.
- D, Roguelite run: hearts and hints last the whole run, each board has a move limit, and you pick a power after each board.

The owner was then asked how A and B should fit: one mode with both ideas, two modes, or a road trip with a clock you can turn on.

**Choice:** A and B, as two separate modes under Endless.

**Reason:** The owner liked the Clock run and the Road trip. The Rising river was too slow to play well. The Roguelite run did not click. The owner wants a fast mode and a calm mode, kept apart.
