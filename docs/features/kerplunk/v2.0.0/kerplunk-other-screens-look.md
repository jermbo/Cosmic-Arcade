---
name: The neo-brutalist look on every other screen
description: "The title, shop, settings, pause, game over, tutorial and shape lab screens get the Light theme."
tags:
  - kerplunk
persona: the player
depends-on:
  - kerplunk-game-screen-look.md
status: ready
---

[Wiki](../../../README.md) / [Kerplunk 2.0.0 stories](kerplunk-stories.md) / The neo-brutalist look on every other screen

# The neo-brutalist look on every other screen

As the player, I want every screen of the game in the same neo-brutalist look, so that the game feels like one thing.

## Requirements

1. These screens use the theme variables, the type and the cards of the game screen
   - a. Title
   - b. Before you start, and Ban a shape
   - c. Shop
   - d. Pause
   - e. Game over
   - f. Settings
   - g. How to play, with its pictures of blocks in the Patterns style
   - h. Notices (update ready, install hint)
   - i. The shape lab
2. Buttons are cards that push into their shadow on a tap
3. A panel opens with a short drop and a hard shadow; no blur behind it
4. The logo on the title screen is in Archivo Black

## Acceptance criteria

1. GIVEN the title screen WHEN the player looks at it THEN the background is `#FFF8E7` with a dot grid
   - a. AND each button has a 3px outline and a hard shadow
2. GIVEN the shop WHEN it opens THEN it is a white card with a 3px outline and a 4px hard shadow
3. GIVEN How to play WHEN it shows a picture of blocks THEN the blocks wear patterns
4. GIVEN the pause screen WHEN the player taps Resume THEN the button pushes into its shadow
5. GIVEN the shape lab WHEN it opens THEN it uses the same type and cards

## Depends on

- [The neo-brutalist game screen](kerplunk-game-screen-look.md): it makes the theme variables, the type and the cards.

## Architecture

- [Spec, scope 3 d](../../../initiatives/kerplunk/v2/spec.md)
