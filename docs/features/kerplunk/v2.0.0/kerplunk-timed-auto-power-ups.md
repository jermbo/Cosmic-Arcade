---
name: "Timed: power-ups act at once"
description: "In Timed mode, an earned power-up acts by itself, in the way that helps most."
tags:
  - kerplunk
persona: the player
depends-on: []
status: ready
---

[Wiki](../../../README.md) / [Kerplunk 2.0.0 stories](kerplunk-stories.md) / Timed: power-ups act at once

# Timed: power-ups act at once

As the player, I want a power-up that I earn in Timed mode to act by itself, so that it helps me and does not cost me time.

## Requirements

1. In Timed, an earned power-up acts after the turn that earned it, before the next drop
2. Prism paints each piece in the tray one color
   - a. The color is the one where the best drop of a painted piece clears the most blocks, as the bot scores it
   - b. On a tie, the lowest color in the order Ember, Amber, Moss, Tide, Dusk wins
3. Blast clears the 3×3 area with the most blocks
   - a. On a tie, the area deepest in the stack wins
4. Remix shuffles the well, as it does today
5. The player sees each act: the same animation as a tapped power-up, and a sticker with its name
6. Timed has no power-up bar
7. A "Start with a power-up" boost acts at the start of a Timed game
8. Endless keeps the power-up bar and tapped power-ups, as today

## Acceptance criteria

1. GIVEN a Timed game WHEN the screen shows THEN there is no power-up bar
2. GIVEN a Timed game WHEN a turn earns a Prism THEN both tray pieces turn one color with no tap
   - a. AND a "Prism" sticker shows
3. GIVEN a well where painting the tray Tide gives the biggest clear WHEN a Prism acts THEN the tray pieces are Tide
4. GIVEN a Timed game WHEN a turn earns a Blast THEN the 3×3 area with the most blocks clears with no tap
5. GIVEN an Endless game WHEN a turn earns a Prism THEN it goes to the power-up bar
6. GIVEN the engine test WHEN a Timed turn that earns a Prism goes in THEN the tray pieces come out in one color, and no other color gives a bigger clear

## Depends on

None.

## Architecture

- [Spec, scope 9 and 10](../../../initiatives/kerplunk/v2/spec.md)
- [Decision log, D6](../../../initiatives/kerplunk/v2/decision-log.md)
- [Game README, Power-ups](../../../../games/kerplunk/README.md)
