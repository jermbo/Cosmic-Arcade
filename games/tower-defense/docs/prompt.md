# Tower defense: v1 prompt

Make a 3D tower defense game for the arcade. A UFO fleet is coming to steal the Heart Crystal. You build towers along the path to stop them.

It should feel like a proper small indie game. Every hit, shot and click should feel good. The UI should look like part of the game.

## 1. Art and assets

- Start with the Kenney Tower Defense Kit in `docs/inspiration/kenney_tower-defense-kit/`. Use the GLB models. Copy into the game only the models it uses.
- Keep one look: low-poly, flat colors, soft light. Use the kit's color texture (`colormap.png`) as the color palette for everything.
- When the kit is missing something we need, make it. A new model, effect, icon or sound must match the kit's look and must be original. Note each new asset in a list, so we know what is Kenney and what is ours.
- Credit Kenney on the title screen, even though the license (CC0) does not ask for it.
- Sound and music: there are none in the kit. Make them in code (Web Audio) or as new audio files. They must be original.

## 2. Tech and the arcade

- three.js with Vite, in `games/tower-defense/`, as an npm workspace. Follow `docs/architecture/game-project.md`:
  - `package.json` has a `build` script and `arcade.engine: "three"`, `arcade.outDir: "dist"`.
  - Vite `base: "./"`, so all paths are relative.
  - The pause menu and the title screen have a link to `../`, labeled "Back to the arcade".
- Add a game entry so the arcade lists it and publishes it at `/games/<slug>/play/`.
- Show a loading screen while the models load.
- 60 fps on a normal laptop. Smooth on a recent phone. Reuse models (instancing) for many enemies or projectiles.

## 3. The board

- The map is a grid of kit tiles: the path, ground you can build on, and decoration (trees, rocks, crystals) that blocks building.
- Enemies come out of a spawn tile, follow the path, and reach the Heart Crystal at the end.
- Fixed tilted camera, like `Sample.png`. A small amount of pan and zoom is OK. The whole map must fit on a phone screen in landscape.
- Hovering over (or selecting) a tile shows the kit's selection marker. Green if you can build there, red if not.

## 4. Towers

Four towers. Each has one clear job.

| Tower | Kit model | Job | Notes |
|---|---|---|---|
| Ballista | `weapon-ballista` + arrow | Pierce | Arrows go through a line of enemies. |
| Cannon | `weapon-cannon` + cannonball | Splash | Damage in a small circle. |
| Crystal | `tower-round-crystals` | Slow | Pulse that slows all enemies in range. Little damage. |
| Catapult | `weapon-catapult` + boulder | Long range | Big, slow shots. Cannot hit high flyers. |

- Levels: Level 1 (build) → Level 2 → Level 3, where the player picks branch A or branch B. Branch choice is final.
- The tower looks different at every level. It stacks taller with the kit's tower parts (bottom, middle, top, roof). Each branch has its own roof and color, so you can read a tower at a glance.
- Placing a tower plays the kit's build steps (`build-a` to `build-f`) as a short build animation.
- Sell gives back 70% of what you spent.

Branch ideas (fine to change if play testing shows something better):

| Tower | Branch A | Branch B |
|---|---|---|
| Ballista | Volley: 3 arrows in a spread | Rail bolt: pierces everything, long range, slow |
| Cannon | Big bore: larger blast | Rapid fire: faster, smaller blast |
| Crystal | Deep freeze: stronger slow, short stun | Shatter: slowed enemies take extra damage |
| Catapult | Boulder storm: 3 rocks per shot | Siege arm: huge range, big single hit |

Targeting: each tower has a target setting (first, strongest, closest). Default: first.

## 5. Enemies

All enemies are UFOs that hover along the path.

| Enemy | Kit model | Type |
|---|---|---|
| Scout | `enemy-ufo-a` | Fast, low health |
| Tank | `enemy-ufo-b` | Slow, lots of health |
| Skimmer | `enemy-ufo-c` | Flies high, straight to the crystal, ignores the path. The catapult cannot hit it. |
| Splitter | `enemy-ufo-d` | Breaks into 2–3 small, fast UFOs when destroyed |

- Elite versions use the `-weapon` models: more health, worth more gold.
- Each map ends with a boss wave: one big elite UFO with a beam (`enemy-ufo-beam`).
- Enemies bob and tilt as they move. They flash when hit. They break into low-poly pieces when destroyed.

## 6. Economy and waves

- Start: 20 lives and some gold. Gold comes from kills and a bonus for clearing a wave.
- Calling the next wave early gives bonus gold.
- Before each wave, show what is coming (icons and counts).
- An enemy that reaches the crystal costs lives (1 for small enemies, more for big ones).
- Health goes up with each wave. New enemy types appear one at a time, so the player learns each one.

## 7. Maps

| # | Name | Tiles | Waves | Idea |
|---|---|---|---|---|
| 1 | Meadow | Grass | 10 | One simple path. Teaches the game. |
| 2 | River | Grass + river | 12 | The path splits and joins. Bridges. Two ways to defend. |
| 3 | Frost | Snow | 15 | Two spawns, a long winding path. The hard one. |

- Maps unlock in order.
- Stars by lives left: 3 stars = 20 lives, 2 stars = 10 or more, 1 star = you won.
- Score = kills + lives left + gold left + a time bonus. Keep the best score for each map.

## 8. Feel ("juice")

- Path preview: the path glows before each wave. Arrows show the way.
- Range preview: a ring when placing or selecting a tower.
- Projectiles have weight: arcs for boulders, trails for arrows, smoke for cannons.
- Particles on hits and kills. Small screen shake on big hits (it can be turned off).
- Swarm clear: when many enemies die fast, play a special effect and sound.
- Losing a life: the crystal flashes, red edge on the screen, a warning sound.
- Sounds for each tower shot, hits, explosions, the UFO hum, placing, upgrading, selling, wave start, win and lose. Simple background music, original.

## 9. Screens and UI

- Title screen: Play, Settings, Credits, Back to the arcade. A slow 3D map in the background.
- Map select: the 3 maps, stars, best score, locked or unlocked.
- In-game HUD: lives, gold, wave X of Y, speed (1x / 2x / 3x), pause, next wave button with the preview.
- Tower panel: stats, upgrade (with the A/B choice at level 2), sell, target setting.
- Pause: resume, restart, settings, quit to map select, back to the arcade.
- Results: win or lose, stars, score, best score, retry, next map.
- Settings: music volume, sound volume, screen shake on or off, reset progress.
- Tutorial: on the first play of Meadow only. 4–5 short steps: place a tower, start a wave, upgrade, speed up. It can be skipped.
- All text in English. The UI is HTML/CSS on top of the 3D view. It should match the game's colors, not look like a web page.

## 10. Controls

| Action | Mouse + keyboard | Gamepad | Touch |
|---|---|---|---|
| Move cursor | Mouse | Left stick / D-pad (tile by tile) | Tap a tile |
| Place / select | Left click | A | Tap |
| Cancel | Right click / Esc | B | Tap empty space |
| Pick tower | 1–4 | LB / RB to cycle | Build menu |
| Upgrade | U | X | Tower panel |
| Sell | S | Y | Tower panel |
| Next wave | Space | Start wave button (Select) | HUD button |
| Speed | F | RT | HUD button |
| Pause | P / Esc | Start | HUD button |

- Phones: landscape only. Show a "rotate your phone" message in portrait. Buttons big enough for a thumb.

## 11. Saving

- Save in `localStorage`: stars, best scores, unlocked maps, settings, tutorial seen.
- Put a version number in the saved data, so a later version can read or reset old saves.

## 12. Testing

- Debug mode with `?debug`: lots of gold, skip wave, 10x speed, show stats.
- Play each map all the way through yourself in the browser. Fix feel, difficulty and UI problems.
- Check: a phone-size screen in landscape, keyboard only, and the arcade build (`npm run build`).
- Balance target: a new player can win Meadow on the first try. Frost needs a plan and maybe a retry.

## 13. How to build it

Work in milestones. Show me after each one.

1. **Plan:** a short plan doc. I approve it before code.
2. **Core loop:** Meadow, Ballista + Cannon, Scout + Tank, waves, gold, lives, win and lose.
3. **Content:** all 4 towers with both branches, all 4 enemies, elites, bosses, all 3 maps, stars.
4. **Polish = v1:** all screens, tutorial, sound, music, juice, gamepad, touch, saving.

## Not in v1

- Endless mode
- Map editor
- Online leaderboards or accounts
