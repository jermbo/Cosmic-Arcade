---
name: ReQuiver
description: "What ReQuiver does: a stick-figure archer roguelike for phones held sideways, with a branching map, run boosts and an upgrade tree."
altitude: part
tags:
  - requiver
---

[Wiki](../../README.md) / ReQuiver

# ReQuiver

ReQuiver is a 2D archer roguelike. The player is a lone stick-figure archer on the left of the field. Waves come from the right. The code is in `games/requiver/`. The game entry is `src/content/games/requiver/`.

## A run

1. The player crosses three acts. Each act is one evening: the sun sets as the player moves across the map.
2. Each act has a branching map of 8 rows. The spot types are fight, elite, shop, rest, event, treasure and boss.
3. After a fight, the player picks 1 of 3 boosts. Slots are few. When they are full, a new boost replaces an old one.
4. Health carries over for the whole run. At 0 health, the run ends.
5. Win or lose, the run pays Feathers. Feathers buy nodes in the upgrade tree.

## A fight

| Rule | Value |
| ---- | ----- |
| Aim | Drag back anywhere, release to shoot. Keys: arrows and Space. Gamepad: left stick and A. |
| Hit zones | A head shot kills a normal foe. A body shot takes 2. Helmets and chest plates come off first. |
| Combo | Kills fill the meter. A miss resets the streak. A full meter gives a bonus shot. |
| Bonus shots | Arrow Rain. A meter filled mostly by head shots gives the Crown Shot instead. |
| Thrown shots | Each has a hit chance. A miss falls short or flies over. The player can shoot them down. |
| Bosses | Each has a weak spot. Hits on it during a wind-up break the attack. |

## Where the content is

Every number and every content entry is data in `games/requiver/src/rules/data/`. See `games/requiver/ARCHITECTURE.md` for how to add a foe, a boost, an event or a node, and how to swap the art.

## PWA

The play build is offline-first: `public/manifest.webmanifest`, maskable icons (`npm run icons -w requiver`), and a service worker Vite emits as `sw.js` on `npm run build -w requiver`. Install from the title screen (or Add to Home Screen on iPhone). Logic lives in `games/requiver/src/game/pwa.ts`.

## How it is checked

`npm run sim -w requiver` plays full runs with three bot skills and reports win rates, deaths per act, fight lengths, thrower accuracy and map problems. The run fails when it finds a problem.
