---
name: Rename the currency
description: "The currency is called Plunks, a name that fits Kerplunk."
tags:
  - kerplunk
persona: the player
depends-on: []
status: ready
---

[Wiki](../../../README.md) / [Kerplunk 2.0.0 stories](kerplunk-stories.md) / Rename the currency

# Rename the currency

As the player, I want the currency to have a name that fits Kerplunk, so that the game feels like one thing.

The owner picked the name "Plunks" on 2026-11-17 (spec scope 12 b). The mark ✦ stays.

## Requirements

1. Each text that the player sees says "Plunks" in place of "Glints"
   - a. The title screen, the HUD, the shop, Before you start, the game over screen, the tutorial and the notices
   - b. One Plunk is "1 Plunk"
2. The mark ✦ and the amounts do not change
3. The names in the code may stay `glints`

## Acceptance criteria

1. GIVEN the title screen WHEN the player looks at the wallet THEN it says "Plunks"
2. GIVEN a finished game WHEN the game over screen shows THEN its lines say "Plunks earned" and "Plunks saved"
3. GIVEN the shop WHEN it opens THEN no text says "Glints"

## Depends on

None.

## Architecture

- [Spec, scope 12 b](../../../initiatives/kerplunk/v2/spec.md)
- [Game README](../../../../games/kerplunk/README.md)
