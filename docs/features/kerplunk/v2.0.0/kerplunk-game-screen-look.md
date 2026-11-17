---
name: The neo-brutalist game screen
description: "The playing screen gets the Light theme and Patterns blocks."
tags:
  - kerplunk
persona: the player
depends-on: []
status: ready
---

[Wiki](../../../README.md) / [Kerplunk 2.0.0 stories](kerplunk-stories.md) / The neo-brutalist game screen

# The neo-brutalist game screen

As the player, I want the playing screen in a bold neo-brutalist look with patterned blocks, so that the game looks good and I can tell the colors apart without color.

## Requirements

1. The theme is a set of design variables, so that a later theme only changes values
2. The Light theme values
   - a. Background `#FFF8E7` with a dot grid of `#00000014`, 16px apart
   - b. Ink (text, outlines, shadows) `#111111`; cards `#FFFFFF`
   - c. Score card `#FFD93D`; Glints card `#A0E7E5`
   - d. Outline 3px; hard shadow 4px right and 4px down with no blur; corner 6px
   - e. Block colors: Ember `#FF6B6B`, Amber `#FFD93D`, Moss `#6BCB77`, Tide `#4D96FF`, Dusk `#C084FC`
3. The type
   - a. Score and stickers: Archivo Black
   - b. Labels: DM Mono, uppercase
   - c. All other text: Space Grotesk
   - d. The font files are part of the game files and cached for offline play
4. The HUD has a score card with a tilt of -1.5°, and cards for Best and Glints
5. The well, the tray cards and the power-up bar are cards with the outline and the hard shadow
6. Blocks have a 2.5px ink outline and wear the Patterns style
   - a. Ember: diagonal stripes
   - b. Amber: dots
   - c. Moss: plain
   - d. Tide: checks
   - e. Dusk: rings
7. A tap on a card or button pushes it into its shadow
8. A clear: each block hops up and left by 3px, then falls and turns while it shrinks; the blocks go one after the other from the first block of the group
9. The points of a clear show on a sticker in the score-card color, tilted -4°, that rises and fades

## Acceptance criteria

1. GIVEN a new game in Endless WHEN the screen shows THEN the background is `#FFF8E7` with a dot grid
   - a. AND the score card is yellow and tilted
2. GIVEN a well with one block of each color WHEN the player looks at it THEN Ember has stripes, Amber dots, Moss is plain, Tide checks and Dusk rings
3. GIVEN the grayscale filter of the phone is on WHEN the player looks at the well THEN the five colors look different
4. GIVEN the player taps a tray card WHEN the finger is down THEN the card sits in its shadow
5. GIVEN a group of 4 Moss blocks WHEN it clears THEN the blocks hop and fall one after the other
   - a. AND a sticker shows the points
6. GIVEN the game was opened once online WHEN the network is off and the game reloads THEN the score shows in Archivo Black

## Depends on

None.

## Architecture

- [Spec, scope 3, 4 a, 5 a, 5 d](../../../initiatives/kerplunk/v2/spec.md)
- [Decision log, D3 and D4](../../../initiatives/kerplunk/v2/decision-log.md)
