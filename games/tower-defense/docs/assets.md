# Assets

What is from the Kenney kit, and what is ours.

## From Kenney

Tower Defense Kit 2.1 by Kenney (kenney.nl), CC0. The source is in `inspiration/kenney_tower-defense-kit/`. The game copies only the GLB models it uses into `public/models/`, with the color texture `Textures/colormap.png`.

- Tiles: grass and snow ground, roads, corners, splits, ends, spawns, rivers, bridges, trees, rocks, crystals, hills.
- Towers: round and square bottoms, middles and tops; the crystal top.
- Weapons and ammo: ballista and arrow, cannon and cannonball, catapult and boulder.
- Enemies: UFO a to d, their armed versions, and the beam.
- Selection markers.

The list of models is in `src/assets.ts`.

## Made for this game

All made in code. No image or audio files.

| Asset | Where |
| --- | --- |
| Branch flags on level 3 towers | `src/game/tower.ts` |
| Spawn portal ring | `src/game/board.ts` |
| Island base under the board | `src/game/board.ts` |
| Heart Crystal (kit crystals, tinted and animated) | `src/game/board.ts` |
| Frost shell on slowed UFOs, health bars | `src/game/enemy.ts` |
| Road arrows, range rings, ghost towers | `src/game/game.ts` |
| Particles, blasts, rings, floating numbers | `src/game/effects.ts` |
| Tower and UFO icons (rendered from the models) | `src/icons.ts` |
| Coin and crystal icons, logo, stars, sky | `src/style.css` |
| All sound effects and music (Web Audio) | `src/audio.ts` |
