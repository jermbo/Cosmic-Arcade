---
name: Use both pieces before a refill
description: "The tray gives two new pieces only when both pieces are used."
tags:
  - kerplunk
persona: the player
depends-on: []
status: ready
---

[Wiki](../../../README.md) / [Kerplunk 2.0.0 stories](kerplunk-stories.md) / Use both pieces before a refill

# Use both pieces before a refill

As the player, I want new pieces only after I use both pieces in the tray, so that a big combo comes from a plan and not from waiting.

## Requirements

1. A used slot stays empty while the other slot has a piece
   - a. The empty slot shows an empty tray card (dashed outline)
2. When both slots are used, two new pieces come at the same time
3. A Lab game with 3 pieces refills only when all 3 are used
4. Reroll swaps only the pieces that are in the tray
5. A Prism paints only a piece that is in the tray
6. The game ends when no piece in the tray fits and the player holds no Blast
7. The bot and the sim play by the same rule

## Acceptance criteria

1. GIVEN a tray with the pieces `###` and `##/##` WHEN the player drops `###` THEN slot 1 is empty
   - a. AND slot 2 still has `##/##`
2. GIVEN slot 1 is empty and slot 2 has `##/##` WHEN the player drops `##/##` THEN both slots get a new piece
3. GIVEN slot 1 is empty and slot 2 has `##/##` WHEN the player rerolls THEN slot 2 gets a new piece
   - a. AND slot 1 stays empty
4. GIVEN slot 1 is empty and the piece in slot 2 does not fit and the player holds no Blast WHEN the turn ends THEN the game is over
5. GIVEN the engine test WHEN a tray with one used piece goes in THEN one slot is empty in the result
6. GIVEN the bot test WHEN the bot plays a full game THEN it never places a piece from an empty slot

## Depends on

None.

## Architecture

- [Spec, scope 2](../../../initiatives/kerplunk/v2/spec.md)
- [Game README](../../../../games/kerplunk/README.md)
