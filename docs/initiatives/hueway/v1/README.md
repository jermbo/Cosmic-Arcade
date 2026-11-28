---
name: Hueway v1
description: "The plan for Hueway 1.0: a cozy color-line puzzle with daily puzzles, practice, a shop and offline play."
altitude: initiative
tags:
  - hueway
---

[Wiki](../../../README.md) / Hueway v1

# Hueway v1

Hueway (`games/hueway`) is a color-line puzzle for the arcade. Each color has two dots. The player draws a line to join each pair. Lines can't cross, and every square must be filled. The idea is well known. Version 1 builds the main game well, so that a twist (an endless run) can come next. The [decision log](decision-log.md) records each choice and the reason for it.

## Goals

1. **The main game, done well.** Smooth drag drawing on a phone, cuts that undo when you pull back, and puzzles with exactly one answer.
2. **Modes like Mozzi and Wordkin.** A daily puzzle that grows through the week, the days of this week, and practice at any size.
3. **An endless twist.** Two Endless modes: a fast Clock run and a calm Road trip.
4. **Things to collect.** Coins buy themes, line styles, dot styles and sound packs.
5. **A PWA.** It installs as an app and plays offline.

## What is in 1.0

- Five levels by board size: Easy 5×5, Medium 6×6, Hard 7×7, Expert 8×8, Master 9×9.
- Today: Monday Easy, Tuesday and Wednesday Medium, Thursday and Friday Hard, Saturday Expert, Sunday Master.
- Practice: numbered puzzles per level, made from a seed, so they are the same on every device.
- Hints: each hint draws one right line (of the lines that are not right yet, the one of middle length).
- Moves: a move is a drag on a different color than the last one. Perfect means one move per color and no hints.
- Tint, a paint-drop mascot, takes the color of the line you draw.
- Each line plays its own little tune as it grows (soft synth, Web Audio).
- Endless has two modes (see [D7](decision-log.md#d7-endless-is-two-modes-clock-run-and-road-trip)):
  - **Clock run:** 60 seconds to start. Each solved board adds 4 seconds per row. Boards grow every two solves, from 4×4 to 9×9. The score is the number of boards. Back ends the run.
  - **Road trip:** no clock. Line 0 (red) is the road. It starts on the left edge, in the row where the last stop's road left, and ends on the right edge. Boards grow every five stops, from 5×5 to 7×7. The trip is saved, so you can stop and go on later. A map shows the last 40 stops.
- Endless boards have no hints. All their numbers live in `src/core/endless.ts` and `EARN_ENDLESS` in `src/app/shop.ts`.

## How puzzles are made

1. Start with every square as its own tiny line.
2. Keep joining two line ends that sit side by side. A joined line must never touch itself.
3. When no join helps, a short line cuts into the middle of a next-door line, and the cut-off tail becomes a new line.
4. Stop when there are few enough lines and none is shorter than 3.
5. Keep the two ends of each line as dots. The solver checks that there is exactly one answer.

The solver grows the line with the fewest moves first, and throws out a board early when a square has no way in or out, or when the two ends of a line can't meet. A 9×9 puzzle takes about 15 ms to make and check.

## Not in 1.0

- Bridges, color mixing and other twists from the first talk.
- Gamepad controls.
