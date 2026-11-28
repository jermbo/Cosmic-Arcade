---
name: Flippity v1
description: "The plan for Flippity 1.0: a cozy pebble-flipping game against three bots or a friend, with Pips and a shop."
altitude: initiative
tags:
  - flippity
---

[Wiki](../../../README.md) / Flippity v1

# Flippity v1

Flippity (`games/flippity`) is an Othello-style game for the arcade. Two players put pebbles on a board. A pebble that traps a line of the other color flips that line. When the board is full, or nobody can move, the player with more pebbles wins. The look comes from the [cozy kit](../../arcade/cozy-kit/README.md). The [decision log](decision-log.md) records each choice, and the [spec](spec.md) holds the agreed scope.

## Goals

1. **The main game, done well.** Smooth flips on a phone, a clear turn, and fair rules for passes and the end of the game.
2. **Three bots with a face.** Sleepy, Steady and Sharp. Each one has its own pebble face and its own strength.
3. **Pass and play.** Two people on one phone.
4. **Pips for good moves.** Big flips, double lines, corners and wins earn Pips. Pips buy looks and sounds.
5. **A PWA.** It installs as an app and plays offline, like the other cozy games.

## What is in 1.0

- Board sizes 6×6, 8×8 and 10×10. The player picks one before each game.
- Opponents: Sleepy, Steady, Sharp, or a friend (pass and play).
- Vs a bot, the player picks to go first (dark) or second (light).
- Help: one free hint and one free undo per game. More cost Pips.
- Move dots: a setting that shows the legal moves. It is off by default and is in the accessibility part of Settings.
- The shop sells the cozy kit themes, four pebble styles and four sound packs.
- A game in progress is saved. The title screen shows **Continue**.

## Not in 1.0

- Bloom: a pebble that flips three times locks as a flower. Planned for a later version ([D9](decision-log.md#d9-bloom-comes-later)).
- A daily puzzle, other twists and board shapes.
- Board unlocks (pond, moss, sand, dock). The cozy kit themes do this job ([D4](decision-log.md#d4-no-board-unlocks)).
