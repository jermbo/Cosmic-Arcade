---
name: Hide the daily challenge
description: "The Daily button and the daily bonus go away."
tags:
  - kerplunk
persona: the player
depends-on: []
status: ready
---

[Wiki](../../../README.md) / [Kerplunk 2.0.0 stories](kerplunk-stories.md) / Hide the daily challenge

# Hide the daily challenge

As the player, I want only the modes that are fun today, so that the title screen does not offer a mode that is the same as Endless.

## Requirements

1. The title screen has no Daily button
2. The game over screen shows no daily line
3. No game pays the daily bonus
4. The seed code stays in the engine for a later puzzle mode

## Acceptance criteria

1. GIVEN the title screen WHEN the player looks at the buttons THEN there is no Daily button
2. GIVEN a finished Endless game WHEN the game over screen shows THEN it shows no daily line
3. GIVEN a new save WHEN the player plays the first game of the day THEN the wallet gets no ✦20 bonus

## Depends on

None.

## Architecture

- [Spec, scope 7](../../../initiatives/kerplunk/v2/spec.md)
