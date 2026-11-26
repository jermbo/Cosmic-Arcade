---
name: Exit 0 v0.1 spec
description: "The scope of Exit 0 0.1.0: one data-driven maintenance level with puzzles, a creature, a hazard, checkpoints, and the PS1 look."
altitude: initiative
tags:
  - exit-zero
parent: README.md
status: draft
---

[Wiki](../../../README.md) / [Exit 0 vertical slice](README.md) / Spec

# Exit 0 v0.1 spec

Version: Exit 0 0.1.0. Stories go in `docs/features/exit-zero/v0.1.0/`.

## The problem

The arcade has no slow, quiet game about a place. The owner wants a short first-person horror slice with a 90s look, built so that more levels and puzzles can follow without new core code.

## The solution

One maintenance level, loaded from a level file. Puzzles, story, notes and item names are data. The player explores two moods, repairs a box, opens a keyed door, learns to walk past a sleeping creature, and reaches EXIT 0.

Example: the player reads the panel label, sees "B3 - Pump 2. NEVER WHILE FLOODED", switches B3 on anyway, hears the water sing, and switches it off before they wade in.

## In scope

1. Story and text as data
   - a. The intro, the ending, the area banners, the tips and all UI text are in `src/data/story.json`
   - b. Notes are in `notes.json`; items are in `items.json`
2. The level as data
   - a. A cell map with zones (textures, height, lights, water, footstep sound)
   - b. Entities: decor, sign, light, pickup, door, gate, exit, fake exit, breaker panel, repair station, keypad, trigger, creature, live water
   - c. A level names the level that follows it
   - d. `npm run validate` checks the references and solves the level to the exit
3. Puzzles
   - a. Keys: the MAINTENANCE door needs the key
   - b. Repair: the main box needs the wrench and the fuse, in three held steps
   - c. Hybrid: the breaker panel, and a keypad with a code from a note
4. Dangers
   - a. The Fixture sleeps until it hears a noise. Running, splashing and switches make noise. An alarm wakes it on the path back
   - b. The flood water is live while breaker B3 is on
   - c. Death shows EXIT 1 and retries from the last checkpoint
5. Saves: checkpoints at the start, at the MAINTENANCE door and after the repair, kept in browser storage
6. Look: per-vertex light, vertex snap, affine textures, 240p with dither and a CRT pass; the flashlight matters in dark rooms
7. Sound: hum, drips, footsteps per floor, stings, and music for the title, the halls, the utility rooms and the exit; all made with Web Audio nodes
8. UI: title with continue, intro, pause, settings (volume, look speed, FOV, first or third person, resolution, CRT, wobble, head bob), controls, pockets and notes, tips on first play, game over, ending
9. Input: keyboard and mouse, and a standard gamepad in play and in menus

## Out of scope

- Touch controls (the layout must not block them later)
- Multiplayer
- More than one level
