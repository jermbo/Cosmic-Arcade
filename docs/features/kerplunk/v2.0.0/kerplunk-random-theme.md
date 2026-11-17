---
name: The Random theme
description: "The player can buy Random, and each game rolls a new look inside fixed rules."
tags:
  - kerplunk
persona: the player
depends-on:
  - kerplunk-dark-theme.md
status: ready
---

[Wiki](../../../README.md) / [Kerplunk 2.0.0 stories](kerplunk-stories.md) / The Random theme

# The Random theme

As the player, I want a theme that looks new in each game, so that a run feels fresh.

## Requirements

1. Random is in the Themes section for ✦300
2. With Random in use, each new game rolls a look; the look stays the same for the whole game
3. A roll picks each value from these lists
   - a. Background: `#FFDE59`, `#A0E7E5`, `#FFAEBC`, `#B4F8C8`, `#C3B1E1`, `#FBE7C6`, `#90E0EF`, `#FFC6A8`, `#E4F4A5`
   - b. Score card and Glints card: two different colors from `#FF6B6B`, `#FFD93D`, `#6BCB77`, `#4D96FF`, `#C084FC`, `#FF9F1C`, `#2EC4B6`, `#F72585`, `#FFFFFF`, `#111111`, never the background color
   - c. Well: `#FFFFFF`, `#FFFDF5` or `#111111`
   - d. Block colors: one of four sets of five, each in the order Ember, Amber, Moss, Tide, Dusk
   - e. Display type: Archivo Black or Bricolage Grotesque
   - f. Outline 3px or 4px; shadow 4px, 5px or 6px; corner 0px, 6px or 12px; score tilt from -2.5° to 2.5°
4. The four block color sets
   - a. `#FF6B6B`, `#FFD93D`, `#6BCB77`, `#4D96FF`, `#C084FC`
   - b. `#EF476F`, `#FFD166`, `#06D6A0`, `#118AB2`, `#9D4EDD`
   - c. `#FF5C5C`, `#FFB000`, `#3DDC97`, `#4CC9F0`, `#F15BB5`
   - d. `#FF7A59`, `#F8E16C`, `#00C2A8`, `#5B8DEF`, `#B388EB`
5. Text on a colored card is `#111111` or `#FFFFFF`, whichever has more contrast
6. Ink is `#111111` in every roll
7. Bricolage Grotesque is part of the game files for offline play

## Acceptance criteria

1. GIVEN 342 Glints WHEN the player buys Random THEN the wallet shows 42 Glints
2. GIVEN Random is in use WHEN the player starts two games THEN the looks of the two games can differ
3. GIVEN Random is in use WHEN a game is in progress THEN the look does not change until the game ends
4. GIVEN a roll with a `#111111` score card WHEN the score shows THEN the score is white
5. GIVEN 1000 rolls WHEN each is checked THEN no score card or Glints card has the color of the background

## Depends on

- [Buy and use the Dark theme](kerplunk-dark-theme.md): it makes the Themes section and the active theme.

## Architecture

- [Game README](../../../../games/kerplunk/README.md)
- [Spec, scope 4 b and 4 c](../../../initiatives/kerplunk/v2/spec.md)
