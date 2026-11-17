---
name: Name the game Kerplunk
description: "The game shows the name Kerplunk everywhere, and starts a new save."
tags:
  - kerplunk
persona: the player
depends-on: []
status: ready
---

[Wiki](../../../README.md) / [Kerplunk 2.0.0 stories](kerplunk-stories.md) / Name the game Kerplunk

# Name the game Kerplunk

As the player, I want the game to say Kerplunk everywhere and to start me on a new save, so that the game I play is the new game with no old scores in it.

## Requirements

1. The game shows the name Kerplunk
   - a. The title screen logo says "Kerplunk"
   - b. The browser tab says "Kerplunk"
   - c. The install name and the short name of the app say "Kerplunk"
   - d. The app icons show no text that says Glintwell
   - e. The shape lab page title says "Kerplunk shape lab"
2. The game uses a new save
   - a. The save key is `kerplunk.save.v2`
   - b. The game does not read `glintwell.save.v1`
   - c. A new save has best scores of 0, 0 Glints, the bag at its first size and no bought items
3. The custom shapes of the shape lab stay
   - a. The game still reads `glintwell.shapes.v1`
4. The version is 2.0.0
   - a. The version in the code and in the service worker is `2.0.0`

## Acceptance criteria

1. GIVEN a new browser WHEN the player opens the game THEN the title screen says "Kerplunk"
   - a. AND the browser tab says "Kerplunk"
2. GIVEN the game is installed on a phone WHEN the player looks at the home screen THEN the app name is "Kerplunk"
3. GIVEN a save `glintwell.save.v1` with a best Endless score of 18200 and 342 Glints WHEN the player opens the game THEN the best Endless score is 0
   - a. AND the wallet shows 0 Glints
4. GIVEN a custom shape list saved in the shape lab WHEN the player opens the game THEN the game deals from the custom list
5. GIVEN the title screen WHEN the player looks at the version number THEN it says 2.0.0

## Depends on

None.

## Architecture

- [Spec, scope 11 and 12](../../../initiatives/kerplunk/v2/spec.md)
- [Game project](../../../architecture/game-project.md)
