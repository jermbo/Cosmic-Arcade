---
name: Kerplunk v2 spec
description: "The agreed scope of Kerplunk 2.0.0: harder rules, the neo-brutalist look with unlocks, a new Timed mode, and no daily challenge."
altitude: initiative
tags:
  - kerplunk
parent: README.md
status: agreed
---

[Wiki](../../../README.md) / [Kerplunk v2](README.md) / Spec

# Kerplunk v2 spec

Version: Kerplunk 2.0.0. Stories go in `docs/features/kerplunk/v2.0.0/`.

## The problem

A player who plays Kerplunk for many days finds it too easy: with many shapes and a slot that refills at once, they wait for the right piece. The look does not fit the game. Timed mode punishes the use of power-ups, and the daily challenge is the same as a normal game.

## The solution

The player must use both pieces before new ones come, from a shorter list of shapes, so a big combo takes a plan. The game has a neo-brutalist look, and the player buys new themes and block styles with Glints. In Timed mode, a good chain adds time and power-ups act by themselves.

Example: in Timed, a player makes a chain of 4. The clock gets more seconds. The Prism they earn paints both tray pieces red at once, and the next drop clears a big red group.

## In scope

1. The shape list has about 14 shapes (D1)
   - a. No two-block shapes, no straight four or five, no shapes of 6 or more blocks
   - b. The threes and the common fours stay
   - c. Four fun shapes at a low weight: U, upside-down U, plus, stair
   - d. The exact list and weights come from the shape lab and the sim (not confirmed)
2. The tray refills only when both pieces are used (D1)
   - a. A used slot stays empty until the other piece is used
   - b. The bot and the sim play by the same rule
3. The game has the neo-brutalist look (D3)
   - a. Thick outlines, hard shadows with no blur, flat bold color, Archivo Black, DM Mono and Space Grotesk
   - b. Cards press into their shadow on a tap; a clear makes the blocks hop and fall, and the points show on a sticker
   - c. The fonts come with the game files, so the game works offline
   - d. The look applies to every screen of the game, not only the well (not confirmed)
4. Three themes (D3, D8)
   - a. Light is free and is the default
   - b. Dark and Random are for sale in the shop
   - c. Random rolls a new look at the start of each game, inside fixed rules (not confirmed)
5. Five block styles, each with a second clue for each color (D4, D8)
   - a. Patterns (stripes, dots, plain, checks, rings) is free and is the default
   - b. Symbols, Dice pips, Silhouettes and Faces are for sale in the shop
   - c. Faces blink
   - d. In grayscale, the five colors stay different in each style
6. The shop sells themes and block styles, and the player picks one of each (D8)
   - a. The block skins (Sunset, Ocean, Neon) are gone
   - b. Prices from ✦100 to ✦300 (not confirmed)
   - c. The bag upgrade stays
7. The daily challenge is hidden (D2)
   - a. No Daily button and no daily bonus
8. Timed mode gives time for skill (D6 a)
   - a. A chain or a big group adds seconds to the clock
   - b. The clock starts lower than 90 seconds (not confirmed: the start time and the seconds per chain come from play-tests)
9. In Timed mode, an earned power-up acts at once (D6 b)
   - a. Prism paints the tray pieces in the color that gives the best clear
   - b. Blast clears the 3×3 area that helps most
   - c. Remix shuffles the well
   - d. Timed has no power-up bar to tap
10. Endless keeps power-ups that the player taps (D6 c)
11. A new save (D7)
    - a. The save version goes up; each player starts with no best scores, no Glints and no bought items
    - b. Old saves are not read
12. The game shows the name Kerplunk (D10)
    - a. The title screen, the page title, the install name and the icons say Kerplunk
    - b. The name of the currency changes too (not confirmed: the new name is open)

## Out of scope

1. A ramp in Endless (D9: details open)
2. Missions (D9: details open)
3. Run perks (D9: details open)
4. Shapes to unlock (D9: details open)
5. Links between blocks of one color (D5)
6. Faces that react to play (worried near the top, happy in a chain) (D4: a later step)
7. A daily puzzle mode (D2)
8. The loud and quiet looks of the prototype (D3)
9. A conversion of old saves (D7)
10. A redirect from the old Glintwell URL (D10)

## What changes in the system

**Pages that change**

- `games/kerplunk/README.md`: the sections Shapes, Power-ups, Glints (the shop table) and Daily challenge.
- `docs/initiatives/kerplunk/v2/README.md`: mark the plan as built when the version ships.
- No page of `docs/architecture/` changes. The arcade site does not change.

**Pages that are new**

- `docs/features/kerplunk/README.md`: what Kerplunk does.
- `docs/features/kerplunk/v2.0.0/`: the stories.

**Stored data that changes (one-way door)**

- The save in local storage gets a new key (today `glintwell.save.v1`). The old save is left and not read.
- The save loses the daily record, and the bought skins and the active skin.
- The save gets the owned themes, the active theme, the owned block styles and the active block style.
- The custom shapes of the shape lab (`glintwell.shapes.v1`) do not change. A custom list made for the old 28 shapes still loads.

## How you test it

**What the owner sees on a phone**

- Scope 1: during a game, only the shapes of the new list come. The shape lab shows the new list.
- Scope 2: use one piece; its slot stays empty. Use the other; two new pieces come.
- Scope 3: each screen has the new look. Turn off the network and reload; the fonts still show.
- Scope 4 and 5: buy Dark and Faces in the shop, pick them, and start a game; the game shows them. A grayscale filter on the phone still shows five different blocks.
- Scope 6: the shop has no skins. A buy takes the right number of Glints.
- Scope 7: the title screen has no Daily button.
- Scope 8 and 9: in Timed, a chain adds time. An earned power-up acts at once with no tap.
- Scope 10: in Endless, the power-up bar works as today.
- Scope 11: on a phone with an old save, the game starts with no scores and no Glints.
- Scope 12: the title screen, the browser tab and the installed app say Kerplunk.

**Rules worth an automatic test** (in the tests that exist in `games/kerplunk/tools/`)

- The engine test: a tray with one used piece goes in; the tray still has one empty slot. Both used; two new pieces come out.
- The shape list test: every shape of the list has 3 or more blocks and fits the well.
- The engine test: a Timed turn with a chain of N goes in; the seconds added come out.
- The engine test: a Timed turn that earns a Prism goes in; the tray pieces come out painted in one color, and that color gives a clear at least as big as any other.
- The wallet test: a buy with enough Glints adds the item and takes the price; a buy with too few changes nothing.
- The bot test: the bot plays a full game under the two-piece rule.
- The sim (`npm run sim`), before and after scope 1 and 2: the average score and game length go down. This is a check by the owner, not a pass or fail.
