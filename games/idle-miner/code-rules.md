---
title: Code rules of Idle Orbit
summary: "The facts and the code rules of the Idle Orbit project that differ from the arcade and from the baseline of the code-standards skill."
updated: 2026-11-09
---

# Code rules of Idle Orbit

For the files of this folder, this page wins over `docs/standards/code-rules.md` and over the baseline. Each rule that this page does not name stays as they tell it.

## Facts

| Fact         | Value                                                     |
| ------------ | --------------------------------------------------------- |
| Check        | `npx tsc --noEmit`                                        |
| Test         | `npm run test:tiles`                                      |
| Pacing       | `npm run bot`. It is a tool to tune the game, not a test. |
| Design rules | `design-rules.md` in this folder                          |
| Glossary     | None yet                                                  |

Run each command in this folder.

## Sides of the code

| Side                     | Files                                                                    |
| ------------------------ | ------------------------------------------------------------------------ |
| Canvas: core rules only  | `src/view/`                                                              |
| HTML: core and frontend  | `index.html`, `src/style.css`, `src/ui/`                                          |
| Core rules only          | `src/core/`, `src/content/`, `src/audio.ts`, `tools/`, `vite.config.ts`  |

## Layers

| Layer     | Folders or files                                                                 |
| --------- | -------------------------------------------------------------------------------- |
| Shell     | `src/main.ts`, `src/session.ts`, `src/views.ts`, `index.html`, `src/ui/pwa.ts`, `vite.config.ts`, `tools/` |
| Interface | `src/ui/` (with `src/ui/panels/`), `src/view/`, `src/audio.ts`, `src/style.css`   |
| State     | Each file in `src/core/` that the domain row does not name                       |
| Domain    | `src/content/`, and in `src/core/`: `game.ts`, `direction.ts`, `tiles.ts`, `items.ts`, `grid.ts`, `tile-access.ts`, `planet-map.ts`, `planet-id.ts`, `levels.ts`, `prices.ts`, `effects.ts`, `checks.ts`, `goals.ts`, `unlocks.ts`, `crew-boost.ts`, `machine-count.ts`, `machine-unlock.ts`, `format.ts` |

The domain and the state also run in Node: `tools/bot.ts` plays the game with no browser. So no file in `src/core/` touches the DOM or `window`. Only `save.ts` and `error-log.ts` use `localStorage`, and the bot does not call them.

## `content-as-data`

Changes: adds a rule. It goes further than rule 5 of `names`.

The balance and the content of the game are data. To tune the game, or to add a planet, a person changes data. They do not change a rule.

1. **Each number of balance is data.** A price, a growth, a time, an odds, a reward, and a limit are in the content data. A function of a rule reads the number. It does not hold it.
2. **Each piece of content is one entry in a table.** A planet, a planet map, a machine, a ship upgrade, a research, a perk, a crew member, a goal, and an unlock.
3. **The effect of an entry is in its data.** The code reads what an entry does from its data. No code outside the content names one entry by its id, such as `g.research.belt` in a view.
4. **A link between entries uses the id, not the place in a list.** `planet: 'glacia'`, not `g.planets[1]`.
5. **Text for the player comes from the data.** A goal that names a research reads the name of that research. It does not type the name again.
6. **The data is in `src/content/`, one file for each subject**, such as `planets.ts`, `machines.ts` and `goals.ts`. The files are TypeScript, so the check finds an id that does not exist.
7. **The test checks the content.** Each id that an entry names exists, and each map of a planet follows the rules of a plot.

## `intrinsic-layout`

Changes: rule 5 does not apply.

The game is a canvas on the full screen, with the HUD, the toolbar and the panels on top of it. `position: fixed` is how the shell lays out that screen. It is not a block in a page that scrolls.

## `content-first`

Changes: rules 1, 2 and 3 do not apply. Rules 4 and 5 stay.

Rules 1 and 2 are for a page with a list and filters, and the game has none. Rule 3 forbids help text, but a game teaches its player: the coach of the tutorial and the panel "How to play" stay.

## `tokens`

Changes: where the scales are.

The scales of this game are on `design-rules.md` in this folder, not on the design rules page of the arcade. The colours that the canvas draws are not tokens.
