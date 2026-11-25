# ReQuiver — architecture

A stick-figure archer roguelike. Vite, TypeScript and KAPLAY (`kaplay@3001.0.19`).

## Layers

| Layer | Folder | Job | Imports KAPLAY |
| ----- | ------ | --- | -------------- |
| Rules | `src/rules/` | Map, run, boosts, combo, damage, waves, fights, saves, the bot | No |
| Data | `src/rules/data/` | Every number and every content entry | No |
| Art | `src/art/` | Every visual: sky, figures, arrows, map, icons, particle looks | Yes |
| Game | `src/game/` | Scenes, input, sound, feel (hit stop, shake, particles), flow | Yes |
| Interface | `src/ui/` | HUD and menus in the DOM, neo-brutalist CSS | No |

The rules never import KAPLAY. The headless sim (`scripts/sim.ts`) runs them in Node.

## Add or tune content

All balance numbers live in `src/rules/data/`. Each kind of content is a record: add an entry, and the game picks it up.

| Content | File | Notes |
| ------- | ---- | ----- |
| Global numbers | `balance.ts` | Physics, bow, combo, waves, economy, payout, score |
| Foes | `enemies.ts` | Add the foe to an act's `foes` weights to make it spawn |
| Bosses | `bosses.ts` | Patterns: `summon`, `hurl`, `charge`, `guard` |
| Acts | `acts.ts` | Foe pool, wave budget, map rows, boss |
| Spot types | `spots.ts` | Reuse a `resolve` (`battle`, `shop`, `rest`, `event`, `treasure`) |
| Boosts | `boosts.ts` | Each level holds its full effect as a stat change |
| Bows | `bows.ts` | A stat change; `locked` bows need an unlock node |
| Events | `events.ts` | Choices with weighted outcomes and effects |
| Upgrade tree | `upgrades.ts` | Costs per rank, needs, stat change or unlock |

A new foe art key or boss art key also needs a drawing in the art kit. A new boss pattern kind or spot resolver needs code in `rules/combat.ts` or `rules/run.ts`.

## Swap the art

The game only calls the `ArtKit` interface in `src/art/types.ts`. The views it passes are plain data (positions in a 960 x 540 world, y down, times in seconds).

1. Write a new kit, for example `src/art/ink/kit.ts`, that draws sprites with `k.drawSprite` in place of shapes.
2. Load its images in `load()`.
3. Change the one line in `src/art/index.ts`.

Hit boxes come from the rules (`hitShapes` in `rules/combat.ts`), so new art must line up with them: a biped's head is at `(x + s, y - 63s)` with radius `9s`.

## Saves

`src/rules/save.ts` keeps `SAVE_VERSION`. Bump it when the save shape changes: old saves are wiped, never migrated.

## Commands

| Command | What it does |
| ------- | ------------ |
| `npm run dev -w requiver` | Dev server on port 4011 |
| `npm run phone -w requiver` | Dev server on the local network, port 4012, for a phone |
| `npm run sim -w requiver` | Headless sim: map checks, full runs by three bot skills, campaigns |
| `npm run build -w requiver` | Type check and build to `dist/` |
| `npm run icons -w requiver` | Draws the app icons |

Dev only: open `?drive` to step frames from a script (`__pump(n)`) and save canvas shots (`__shot(name)` writes `.shots/<name>.jpg`).
