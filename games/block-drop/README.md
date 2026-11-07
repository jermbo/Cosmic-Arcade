# Glintwell

A color-matching puzzle game. Drag glass pieces up from the tray into the well. They rise and stick to the ceiling. Pieces never turn: you get what you get. Link 3 or more blocks of one color (side to side, bends allowed, never diagonal) and chain the clears. Big groups pay more, and long chains or big groups earn power-ups.

It is an offline-first PWA for phones. It has no server code, no build step, no network calls and no outside assets. All sound is made in the browser with the Web Audio API.

## The deployable folder

`src/` is the whole game. Copy it as it is to any static host.

```
src/
  index.html             the page
  manifest.webmanifest   name, icons, portrait, standalone, dark theme
  sw.js                  service worker: caches every file on the first visit
  css/style.css
  js/                    game code (ES modules)
  icons/                 192, 512, maskable 192 and 512, Apple touch icon, favicons
```

`npm run build` copies `src/` to `dist/` for the arcade site. The files are the same.

## Host it on a static HTTPS site

Service workers and install need HTTPS (or `localhost`). Any static host works: GitHub Pages, Netlify, Cloudflare Pages, Vercel, S3, or your own server.

1. Upload the contents of `src/` to a folder on the host. It can be the site root or a sub-folder. All paths are relative.
2. Open the URL over HTTPS once. The service worker caches every file.
3. Turn off the network and reload. The game still loads and plays.

Server notes:

- Serve `manifest.webmanifest` as `application/manifest+json` (most hosts do this already).
- Do not cache `sw.js` for a long time. A short cache or `no-cache` is best. The page also asks for updates with `updateViaCache: 'none'`.

## Release an update

1. Change `VERSION` in `src/sw.js` and in `src/js/version.js` (keep them the same).
2. If you add a file, add it to the `FILES` list in `src/sw.js`.
3. Upload the new files.

Players get the new service worker the next time they open the game. When it is ready, they see "Update ready, tap to reload". One tap loads the new files. The old cache is then deleted.

## Install on Android (Chrome)

1. Open the game URL in Chrome.
2. Tap **Install the game** on the title screen. This button shows when Chrome offers the install prompt.
3. If the button does not show, open the Chrome menu (⋮) and tap **Install app** or **Add to Home screen**.

## Install on iPhone (Safari)

iOS has no install prompt, so the title screen shows a short hint.

1. Open the game URL in Safari.
2. Tap **Share** (the square with an arrow up).
3. Tap **Add to Home Screen**, then **Add**.

Notes for iPhone:

- Sound starts after the first tap. iOS blocks audio before that.
- The ring/silent switch mutes Web Audio on iPhone. Turn the ringer on to hear the game.
- iOS has no vibration API, so the Vibration setting is hidden there.

## The preview cannot be installed

A local preview (for example the Vite dev server at `localhost:4002`) is for play-testing only. Install the game from a real HTTPS host.

## Controls

- Touch or mouse: drag a piece from the tray into the well. Pieces do not turn.
- Keyboard: `←` `→` move, `↓` or `Tab` next piece, `Space` drop, `Esc` or `P` pause.

## Shapes

Pieces never turn, and they move as one rigid shape. A piece rises until any block of it touches the ceiling or a stack. It fits only if the whole shape fits, so a shape with a stem needs room for the stem under every part of it. Once it has landed, any block left with a gap above it rises to close the gap.

The shapes live in `src/js/shapes.js` as ASCII art (`#` is a block) with a weight for how often each shows up.

### The secret shape lab

Open `shape-lab.html` on the same site as the game, or tap the version number on the title screen 7 times. It is a visual editor:

- Pick a shape, then press or drag squares to add and remove blocks. Flip, turn, add all turns or add the mirror.
- Set the weight and see the chance it shows up.
- The drop test shows where the rigid shape rests on a random board, and shows when it does not fit. Click to drop it and watch the loose blocks rise.
- **Save to game** keeps your list in this browser, and the game uses it the next time it starts. **Back to built-in shapes** removes it.
- **Copy code** or **Download shapes.js** gives you a file to paste over `src/js/shapes.js`, to make the shapes part of the game for everyone.

## Scoring

Each cleared group scores `blocks × 10 × chain step × group multiplier`.

| Group size | 3 | 4 | 5 | 6 | 7 | 8 | 9+ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Group multiplier | ×1 | ×1 | ×2 | ×3 | ×4 | ×5 | ×6 |

The chain step multiplier is ×1 for the first clear, ×2 for the next, and so on.

## Power-ups

A turn earns one power-up if it makes a chain of 3 or more steps, or clears one group of 6 or more blocks. Which power-up you get comes from a shuffled deck of all three kinds, so you never get the same one twice in a row. They wait in a bar under the well (3 at most; a reward that does not fit is lost, and the deck keeps its card). Tap one to use it.

| Power-up | What it does |
| --- | --- |
| Prism | Pick a color, then a tray piece. The piece turns that one color (it clears itself, plus every block it touches of that color). |
| Blast | Touch the well to aim a 3×3 area, let go to clear it. |
| Remix | The blocks rattle and glow, then every block flies on its own curve to a new cell. The same cells stay filled and every block keeps its color. It avoids leaving a match when it can. |

The numbers are `REWARD_CHAIN`, `REWARD_GROUP`, `GROUP_MULT_FROM` and `GROUP_MULT_MAX` in `src/js/engine.js`.

A game is not over while you hold a Blast, since it can clear room.

## Glints (the meta currency)

Combos earn Glints (✦). They are kept between games, shown on the title screen and in the HUD, and saved with the best scores.

| Source | Glints |
| --- | --- |
| A clear step in a chain | chain step − 1 (so step 2 earns 1, step 3 earns 2) |
| A group of 5 or more | group multiplier − 1 (so 5 blocks earn 1, 6 earn 2) |
| A full clear of the well | 10 |

Things to buy:

| Item | Cost | When | What it does |
| --- | --- | --- | --- |
| Warm-up | 25 | Start of a game | The game plays the first 20 rounds for you. The score and power-ups it earns are yours. Glints earned during the warm-up are not paid out. |
| Start with a power-up | 20 | Start of a game | Begin with a Prism, Blast or Remix. |
| Ban a shape | 30 | Start of a game | Pick one shape from the list. It never shows up this game. |
| Reroll | 10, then +5 each time in a game | Any time (the ↻ button in the HUD), or on the game over screen | Swaps the whole tray for new pieces. |
| Second wind | 40 | Game over after running out of room | Clears the bottom 4 rows of the stack and lets you keep playing. Once per game. |
| +15 seconds | 20 | Game over in Timed | Keep playing for 15 more seconds. Once per game. |
| Bigger bag | 150, then 300 | Shop (permanent) | The power-up bag holds 4, then 5. |
| Block skins | 100 to 150 | Shop (permanent) | Sunset, Ocean and Neon colors for the blocks. |

When you have Glints to spend, starting any game opens a "Before you start" box with the three boosts. Pick what you want and press Start, or choose No thanks.

### Daily challenge

The Daily button starts a game with the same seed for everyone that day, so the pieces come in the same order (power-ups and Remix do not change which pieces you get). It ignores Lab rules. The first run of each day pays ✦20. The best daily score resets each day. Restarting plays the same day again.

All prices and amounts are constants at the top of `src/js/engine.js` (and `src/js/shop.js` for skins). `npm run sim` prints Glints earned per 100 turns.

## Tools

- `npm test` checks the rules on hand-made boards.
- `npm run sim` plays bots and prints game length and how often each chain length happens. Pass a variant name to run one, for example `node tools/sim.js default`.
- Cheats are on at `localhost` and for any page opened with `?debug`. They are off on a real host. Hold Shift and press `1` Prism, `2` Blast, `3` Remix, `4` all three, `5` drop 50 blocks, `6` fill the well, `7` next Remix style, `8` play that style again, `9` add 100 Glints, `0` empty the bag.
- In the console, `glintwell.help()` lists the commands. For example `glintwell.give('remix', 'blast')`, `glintwell.remix('swirl')` (add one and fire it in that style; `glintwell.remixStyles()` lists them), `glintwell.glints(500)`, `glintwell.drop(50)`, `glintwell.fill(0.6)` and `glintwell.bot(50)`.

## Lab

Settings has a Lab panel to test other sizes. Each one starts with the next game:

1. Grid size: small (6×8), medium (7×9), large (8×10).
2. Pieces per turn: 2 or 3.
