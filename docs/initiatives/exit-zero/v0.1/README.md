---
name: Exit 0 vertical slice
description: "The plan for the first playable slice of Exit 0: one maintenance level of 15 to 20 minutes, with a repair puzzle, a keyed door, one creature and one hazard."
altitude: initiative
tags:
  - exit-zero
---

[Wiki](../../../README.md) / Exit 0 vertical slice

# Exit 0 vertical slice

Exit 0 (`games/exit-zero`) is a first-person exploration game with a PS1 horror look. The player falls through a step on the stairs into the maintenance level under the world. They must find the door marked EXIT 0. The [spec](spec.md) holds the scope of version 0.1.0.

## Goals

1. **A clear hook.** The player knows in the first minute why they are here and what EXIT 0 is.
2. **Two moods.** The yellow halls (liminal, humming, mostly lit) and the utility rooms (concrete, pipes, water, dark pockets).
3. **Puzzles as data.** Keys, repairs, switches and codes are entities in a level file. A new puzzle type is one new component.
4. **Danger that sleeps.** One creature and one hazard. Each is quiet until the player wakes it, and each is taught before it can kill.
5. **The wish for more.** The ending opens on stairs that go down, to the next level.

## The hook of the world

The exits are numbered like exit codes. EXIT 1, EXIT 2 and EXIT 7 open onto brick. Only EXIT 0, a clean shutdown, is real. The creature is "the Fixture": a tall pale figure with a ceiling light for a head. Its light flickers with the hum when it sleeps, and the lights near it stutter when it walks.

## The critical path

1. Wake in the start room under a hole in the ceiling. Read the first note.
2. See EXIT 0 through a dead gate at the end of the long hall. The gate needs breaker B4.
3. See the Fixture through a window. A note says: it listens; walk.
4. Find the key on Desk 4 in the dark office, with the flashlight.
5. Open the MAINTENANCE door. Checkpoint.
6. Walk past the Fixture's back door. Take the wrench from the pipe gallery.
7. Wade through the flood room for the fuse. Switching on B3 (the pump) makes the water live.
8. Repair the main box: unbolt, seat the fuse, bolt. Checkpoint.
9. Switch on B4. An alarm wakes the Fixture, and it starts to patrol. Walk back to the gate.
10. Go through EXIT 0.

Detour: a sticky note on the water cooler gives the code for Locker 3, which holds a hand-drawn map.

## Later

- Levels 1 to 4, chained through `next` in each level file.
- Touch controls for landscape phones.
- More puzzle types: valves, fuse routing, timed lights.
