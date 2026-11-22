---
name: Kerplunk v2
description: "The plan to make Kerplunk harder, better looking and worth coming back to: the changes, the order to build them, and the open questions."
altitude: initiative
tags:
  - kerplunk
---

[Wiki](../../../README.md) / Kerplunk v2

# Kerplunk v2

Kerplunk (`games/kerplunk`) works, but it is too easy, its look does not fit, and a player has no reason to come back after a week. This initiative fixes those three problems. The [decision log](decision-log.md) records each choice and the reason for it. The [spec](spec.md) holds the scope of version 2.0.0.

## Goals

1. **More challenge.** A good move comes from a plan, not from waiting for the right piece.
2. **A look with character.** A neo-brutalist design that keeps high contrast and never uses color as the only clue.
3. **A reason to come back.** Goals to chase, things to unlock, and runs that feel different.

## What changes

### 1. Fewer, more fun shapes

The game has 28 shapes today. Cut the list to about 14:

- Remove the two-block shapes. They fill gaps too easily.
- Remove the straight four and five, and the shapes of 6 or more blocks. They feel random.
- Keep the threes and the common fours.
- Add a small set of fun shapes at a low weight: the U, the upside-down U, the plus and the stair.

Proposed list (pieces never turn, so each form is its own shape):

| Group  | Shapes                                                                 | Weight |
| ------ | ---------------------------------------------------------------------- | ------ |
| Threes | `###`, `#/#/#`, `##/#.`, `##/.#`, `#./##`, `.#/##`                     | 3      |
| Fours  | `##/##`, `###/.#.`, `.##/##.`, `##./.##`                               | 3      |
| Fun    | `#.#/###` (U), `###/#.#` (n), `.#./###/.#.` (plus), `#../##./.##` (stair) | 1      |

Tune the final list with the shape lab and `npm run sim`.

### 2. Use both pieces before a refill

Today a slot refills as soon as you use its piece. In v2 the tray refills only when both pieces are used. The player must place the piece they do not want, so a big combo takes a plan.

Effects to check:

- Games end sooner. Check the prices of Reroll and Second wind again.
- The bot in `tools/bot.js` and the sim must follow the new rule.
- Compare the average score and game length before and after with `npm run sim`.

### 3. The neo-brutalist look

Thick outlines, hard shadows with no blur, flat bold color, a heavy display type (Archivo Black), mono labels (DM Mono) and a grotesk for the rest (Space Grotesk). Cards press into their shadow when you tap them. The score card has a small tilt, like a sticker. A clear makes the blocks hop and fall, and the points show on a sticker.

The look has two parts that a player picks one at a time: a **theme** and a **block style**.

**Themes**

| Theme  | What it is                                                                                     | Unlock       |
| ------ | ---------------------------------------------------------------------------------------------- | ------------ |
| Light  | Cream dotted paper, white cards, black ink.                                                     | Free         |
| Dark   | Near black, off-white outlines and off-white hard shadows.                                      | ✦150 (draft) |
| Random | Each game rolls a new background, accents, block palette, display type, outline, shadow, corner and tilt, inside fixed rules. | ✦300 (draft) |

**Block styles.** Each style gives each color a second clue, so the game reads in grayscale.

| Style       | The clue for each color                                  | Unlock       |
| ----------- | -------------------------------------------------------- | ------------ |
| Patterns    | Stripes, dots, plain, checks, rings.                     | Free (default) |
| Symbols     | A solid black shape: triangle, circle, diamond, square, plus. | ✦100 (draft) |
| Dice pips   | One to five dots.                                        | ✦100 (draft) |
| Silhouettes | The block outline: square, circle, leaf, octagon, arch.  | ✦150 (draft) |
| Faces       | A face with a mood: grumpy, happy, sleepy, surprised, wink. Faces blink. | ✦250 (draft) |

The themes and block styles replace the block skins in the shop today (Sunset, Ocean, Neon).

Build notes:

- The well draws blocks on a canvas from sprites (`src/js/sprites.js`). Each block style is a new sprite painter. Each theme is a set of design variables for the CSS and the colors for the sprites.
- The game must work offline, so the fonts come with the game files, not from a font service.
- A Faces later step: the faces react to play (worried near the top, happy in a long chain).

### 4. Shelve the daily challenge

The daily run is the same as a normal run with extra Glints, so it gives no new fun. Hide the Daily button and its bonus. Keep the seed code for a later puzzle mode (a fixed board and fixed pieces).

### 5. Timed mode: earn time, power-ups apply themselves

- **Earn time.** Start with less time on the clock. A chain or a big group adds seconds (for example, a chain of 3 adds 3 seconds and a chain of 4 adds 10). A strong player plays longer.
- **Auto power-ups.** In Timed, an earned power-up acts at once, so it costs no time:
  - Prism paints the pieces in the tray in the color that gives the best clear (the bot scores the choices).
  - Blast clears the 3×3 area that helps most.
  - Remix shuffles the well at once.
- Endless keeps power-ups that you tap, because there is time to think.

### 6. Endless gets harder over time

Endless has no ramp today. Add a slow ramp, for example a new color after a set score, or the stack moves down one row every N turns. Tune it with the sim.

### 7. Reasons to come back

- **Missions.** Three goals at a time, such as "make a chain of 5" or "clear 20 red blocks". A mission pays Glints and a new one takes its place. This gives a daily reason to play without a daily mode.
- **Run perks.** At set scores, pick 1 of 3 perks for this run only, such as "chains pay double" or "Blast is bigger".
- **Unlockable shapes.** Some fun shapes join the game only after you unlock them.

### 8. Saves

The rules, shapes and shop change, so old best scores do not compare. Bump the save version and start new saves. Do not convert old saves.

## Build order

Each step is one story. Play-test on a phone after each step.

1. Shapes and the two-piece refill (sections 1 and 2), with the sim before and after. Bump the save version, and rename the game to Kerplunk inside the code.
2. The neo-brutalist look: Light theme and Patterns blocks (section 3).
3. The shop: Dark and Random themes, and the four other block styles.
4. Shelve the daily challenge (section 4).
5. Timed mode changes (section 5).
6. The Endless ramp (section 6).
7. Missions (section 7).
8. Run perks (section 7).
9. Unlockable shapes (section 7).

## Open questions

- The new name of the currency (today "Glints").
- The prices of the themes and block styles. The numbers above are drafts.
- The time values in Timed mode: the start time and the seconds for each chain.
- Which ramp feels best in Endless: more colors, or a stack that moves down.
- Does Random roll a new look each game, or only when the player asks?
- Does the Faces style get its reactions in step 3, or later?
