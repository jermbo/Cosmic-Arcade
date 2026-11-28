---
name: Flippity v1 spec
description: "The agreed scope of Flippity 1.0.0: Othello-style play against three bots or a friend, Pips for good moves, and a shop of cozy looks."
altitude: initiative
tags:
  - flippity
parent: README.md
status: agreed
---

[Wiki](../../../README.md) / [Flippity v1](README.md) / Spec

# Flippity v1 spec

Version: Flippity 1.0.0. Stories go in `docs/features/flippity/v1.0.0/`.

## The problem

The arcade has no calm two-player board game. The cozy puzzle games are all solo. A player who wants a short game against a fair opponent, or a game with a friend on one phone, has nothing to pick.

## The solution

Flippity is an Othello-style game with the cozy kit look. The player picks an opponent and a board size, then plays. Good moves earn Pips, and Pips buy themes, pebble styles and sounds.

Example: a player picks Steady on 8×8 and goes first. They take a corner (+1 Pip) and later flip 6 pebbles in one move (+1). They win 38 to 26 (+10). The end sheet shows 12 Pips. They buy Sea glass pebbles.

## In scope

1. The rules of Othello (D3)
   - a. Dark moves first. The four start pebbles sit in the center, two of each color, set diagonally
   - b. A move must trap at least one line of the other color. Every trapped line flips
   - c. A player with no move passes. A note says so
   - d. The game ends when neither player can move. More pebbles wins. Equal counts are a draw
2. Board sizes 6×6, 8×8 and 10×10, picked before each game (D5)
3. Three bots (D2)
   - a. Sleepy plays a random legal move, a little drawn to big flips
   - b. Steady plays the best move one step ahead, and knows corners are good and the squares next to them are bad
   - c. Sharp searches several moves ahead in a limited time, and plays the end of the game exactly when few squares are left
   - d. Each bot has a pebble face
   - e. The bots think off the main thread, so the flips stay smooth
4. Pass and play: two people share one phone (D2)
5. Vs a bot, the player picks to go first (dark) or second (light)
6. Pips (D6)
   - a. Vs a bot, the player's moves earn: 5 to 7 pebbles flipped +1, 8 or more +3, two lines at once +2, three or more lines +3, a corner +1
   - b. A win earns 5 (Sleepy), 10 (Steady) or 20 (Sharp). A 10×10 win earns 5 more. A draw earns a little
   - c. A win with no pebbles left for the bot earns 10 more
   - d. Move Pips go to the wallet at the end of the game. An undo takes back the Pips of the moves it undoes
   - e. Pass and play earns nothing
   - f. All numbers live in `EARN` in `src/app/shop.ts` (not confirmed: tune after play-tests)
7. Help (D8)
   - a. One free hint and one free undo per game
   - b. Then a hint costs 5 Pips and an undo costs 3 Pips (not confirmed)
   - c. A hint shows the move Sharp would play
   - d. Vs a bot, an undo takes back the bot's move and the player's move before it
   - e. Move dots: a setting, off by default, that shows each legal move. Screen readers always hear which squares can be played
8. The shop (D7)
   - a. The cozy kit themes. Oat and Plum are free
   - b. Pebble styles: River stone (free), Sea glass, Marble, Gem
   - c. Sound packs: Plip (free), Clack, Chime, Knock. All synth sounds, made with Web Audio
9. The look (D4)
   - a. The board is a clay tray in the colors of the theme, with a soft dip for each square
   - b. A pebble drops in with a ripple. Flips roll out from the new pebble, one after the other
   - c. Soft and Bold styles both work. Calm motion turns the motion off
10. The game in progress is saved. Continue on the title screen goes back to it
11. A PWA: it installs and plays offline
12. Keys: arrows move, Enter or Space plays, Z undoes, H gives a hint, Esc goes back

## Not in scope

- Bloom and the other twists (D9)
- A daily puzzle (D2)
- Board unlocks (D4)
- Online play and gamepad controls
