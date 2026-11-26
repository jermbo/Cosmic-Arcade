# Exit 0 architecture

A first-person exploration game in three.js. Levels, puzzles, story and notes are data. Code reads the data; it never holds story text.

## Folders

| Folder | What it holds |
| ------ | ------------- |
| `src/data/` | `story.json` (intro, ending, area names, tips, all UI text), `notes.json`, `items.json`, `levels/*.json` |
| `src/core/` | Pure logic with no three.js: data types, the game state, conditions, the cell grid and path finding. The validator script uses it too. |
| `src/world/` | The world at play time: the component registry, the player, collisions. |
| `src/world/components/` | One file per family of entity types: decor, pickups, doors, puzzles, hazards. |
| `src/render/` | The PS1 look: textures painted in code, the vertex-lit shader, the level mesh, lights, particles, the low-res post pass. |
| `src/game.ts` | The flow: title, new game, checkpoints, death, the ending. Camera, targeting, HUD. |
| `src/actions.ts` | What each action in the data does. |
| `src/audio.ts` | All sound and music, made with Web Audio nodes. |
| `src/ui.ts`, `src/style.css` | Menus, HUD, notes, keypad. |
| `src/tuning.ts` | Player speeds and footstep noise. The creature's numbers are `FIXTURE` in `components/hazards.ts`. |

## A level

A level file has a cell map (`map`, one char per 2 m cell), a `zones` table that says what each char looks like, `checkpoints`, and a list of `entities`. Each entity has an `id`, a `type`, a spot `at` in cells, and the fields its type reads.

All world state lives in `GameState`: flags, numbers, the inventory and the notes. A door is open when the flag `open.<id>` is set. A pickup is gone when `got.<id>` is set. So a checkpoint is just a copy of the state, and loading one calls `sync()` on every component.

## Conditions and actions

A condition is `true`, `{ "item": id }`, `{ "flag": name }`, or `not`, `all`, `any` of those. Actions are listed in `src/core/types.ts`: `setFlag`, `give`, `take`, `say`, `note`, `sound`, `checkpoint`, `noise`, `alarm`, `tutorial`, `ending` and `if`.

## Add a puzzle type

1. Make a factory in `src/world/components/` and call `register('myType', (def, world) => ...)`.
2. Return a component: `interactions()` for what the player can use, `update()` for each frame, `sync()` to show the state after a load.
3. Keep the state in flags or `state.vars`, so checkpoints save it.
4. Import the file in `components/index.ts`.
5. Teach `scripts/validate-level.ts` how the solver plays it, if it can block the way.

## Add a level

1. Add `src/data/levels/<id>.json` and list it in `src/data/levels/index.ts`.
2. Set `next` on the level before it.
3. Run `npm run validate -w exit-zero`. It checks every reference and plays the level as a greedy solver to the exit.

## The look

Each surface is lit per vertex by the 16 nearest lights, then snapped to a low-res grid, with affine texture mapping and per-vertex fog. The flashlight is per pixel. The scene renders at 240 lines (or 360, 480) and is scaled up with 15-bit color, a 4x4 dither, and an optional CRT pass.
