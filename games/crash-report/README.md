# Crash Report

A 3D chain-reaction game. Launch one car into a busy junction, push your wreck in slow motion, and cause the biggest pile-up you can.

Built with Vite, TypeScript (strict), three.js and Rapier.

## Commands

Run each command in this folder.

| Command           | What it does                                                        |
| ----------------- | ------------------------------------------------------------------- |
| `npm run dev`     | Starts the game on port 4005.                                       |
| `npm run build`   | Checks the types and builds the game into `dist/`.                  |
| `npm run bot`     | Plays each junction with random inputs, with no browser. See below. |

## Where things are

| Part              | Files                                                          |
| ----------------- | -------------------------------------------------------------- |
| Tuning values     | `src/config.ts`. Every force, limit and time of the game.      |
| Junctions         | `src/levels/`. One data file for each junction.                |
| Rules of a run    | `src/sim/`. Physics, traffic, scoring. No drawing, no sound.   |
| Picture           | `src/render/`. Scene, models, particles, camera.               |
| Sound             | `src/audio.ts`. All sound is made in code.                     |
| Menus and HUD     | `index.html`, `src/style.css`, `src/ui.ts`.                    |
| Input             | `src/input.ts`. Keyboard, mouse, touch, gamepad.               |
| The loop          | `src/game.ts`.                                                 |

## Add a junction

1. Copy a file in `src/levels/` and change the data. `types.ts` tells what each field means.
2. Add it to the list in `src/levels/index.ts`.
3. Run `npm run bot` to see what scores are possible, then set the goals.

## Replays

The sim uses a fixed time step and gives the same run for the same inputs. So a replay is only the list of inputs. A change to `config.ts` or to a junction makes its old replays invalid, and the game drops them.

## The bot

`npm run bot 60` plays each junction 60 times with random inputs. It prints the range of scores, and it warns when the same inputs give two different runs.
