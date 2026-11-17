---
name: Buy and use the Dark theme
description: "The shop sells themes in place of skins, and the player can buy and pick Dark."
tags:
  - kerplunk
persona: the player
depends-on:
  - kerplunk-other-screens-look.md
status: ready
---

[Wiki](../../../README.md) / [Kerplunk 2.0.0 stories](kerplunk-stories.md) / Buy and use the Dark theme

# Buy and use the Dark theme

As the player, I want to buy the Dark theme with Glints and pick it, so that I can play in a dark look that I earned.

## Requirements

1. The shop has a Themes section
   - a. Light: free, owned from the start
   - b. Dark: ✦150
   - c. Each item shows a small preview of the theme, its price or "Owned", and "Use" or "In use"
2. The block skins (Sunset, Ocean, Neon) are not in the shop and not in the game
3. The bag upgrade stays in the shop, with its prices of today
4. A buy with enough Glints takes the price and owns the theme; with too few, the buy button is off
5. "Use" makes the theme active at once, on every screen
6. The save holds the owned themes and the active theme
7. The Dark theme values
   - a. Background `#121212` with a dot grid of `#FFFFFF0F`
   - b. Text, outlines and shadows `#F4F1EA`; cards `#1E1E1E`
   - c. Score card `#FFD93D` with `#111111` text; Glints card `#C084FC`
   - d. Well `#1A1A1A`, empty cells `#262626`, block outlines `#0A0A0A`
   - e. Block colors as in Light

## Acceptance criteria

1. GIVEN 342 Glints and Dark not owned WHEN the player buys Dark THEN the wallet shows 192 Glints
   - a. AND Dark shows "Owned"
2. GIVEN 100 Glints and Dark not owned WHEN the player opens the shop THEN the buy button of Dark is off
3. GIVEN Dark is owned WHEN the player taps "Use" THEN the shop and every screen after it are dark
4. GIVEN Dark is in use WHEN the player closes and opens the game THEN the game is dark
5. GIVEN the shop WHEN it opens THEN it shows no Sunset, Ocean or Neon
   - a. AND it shows the bag upgrade
6. GIVEN the wallet test WHEN a buy with too few Glints goes in THEN the wallet and the owned items do not change

## Depends on

- [The neo-brutalist look on every other screen](kerplunk-other-screens-look.md): the shop and every screen must read the theme variables.

## Architecture

- [Spec, scope 4 b and 6](../../../initiatives/kerplunk/v2/spec.md)
- [Decision log, D8](../../../initiatives/kerplunk/v2/decision-log.md)
