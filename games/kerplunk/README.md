# Kerplunk

A color-matching puzzle game. Drag pieces up from the tray into the well. They rise and stick to the ceiling. Pieces never turn: you get what you get. Link 3 or more blocks of one color (side to side, bends allowed, never diagonal) and chain the clears. Big groups pay more, and long chains or big groups earn power-ups.

It is an offline-first PWA for phones. It has no server code, no build step and no network calls. The fonts come with the game files. All sound is made in the browser with the Web Audio API.

## The deployable folder

`src/` is the whole game. Copy it as it is to any static host.

```
src/
  index.html             the page
  manifest.webmanifest   name, icons, portrait, standalone
  sw.js                  service worker: caches every file on the first visit
  css/                   styles, one file for each block
  fonts/                 the woff2 files of the four fonts (see "Fonts")
  js/                    game code (ES modules)
  icons/                 192, 512, maskable 192 and 512, Apple touch icon, favicons
```

`npm run build` copies `src/` to `dist/` for the arcade site. The files are the same.

## Host it on a static HTTPS site

Service workers and install need HTTPS (or `localhost`). Any static host works: GitHub Pages, Netlify, Cloudflare Pages, Vercel, S3, or your own server.

1. Upload the contents of `src/` to a folder on the host. It can be the site root or a sub-folder. All paths are relative.
2. Open the URL over HTTPS once. The service worker caches every file, the fonts too.
3. Turn off the network and reload. The game still loads and plays.

Server notes:

- Serve `manifest.webmanifest` as `application/manifest+json` (most hosts do this already).
- Do not cache `sw.js` for a long time. A short cache or `no-cache` is best. The page also asks for updates with `updateViaCache: 'none'`.

## Release an update

1. Change `VERSION` in `src/sw.js` and in `src/js/version.js` (keep them the same). This version is `2.0.0`.
2. If you add a file, add it to the `FILES` list in `src/sw.js`.
3. Upload the new files.

Players get the new service worker the next time they open the game. When it is ready, they see "Update ready, tap to reload". One tap loads the new files. The old cache is then deleted.

## Install on Android (Chrome)

1. Open the game URL in Chrome.
2. Tap **Install the game** on the title screen. This button shows when Chrome offers the install prompt.
3. If the button does not show, open the Chrome menu (⋮) and tap **Install app** or **Add to Home screen**.

The installed app is called Kerplunk.

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

## Modes

| Mode    | What it is                                                                                     |
| ------- | ---------------------------------------------------------------------------------------------- |
| Endless | Play until no piece fits. Earned power-ups wait in the bar until you tap them.                  |
| Timed   | Play against the clock. Good chains add time. Earned power-ups act by themselves.               |

## The tray

The tray holds 2 pieces (3 with the Lab setting). A slot that you use stays empty, and shows a dashed card, while another slot still has a piece. When every slot is used, new pieces come for all of them at the same time. So you must also place the piece you do not want.

- A Reroll swaps only the pieces that are in the tray. An empty slot stays empty.
- A Prism paints only a piece that is in the tray.
- The game ends when no piece in the tray fits and you hold no Blast.
- The bot and the sim play by the same rule.

## Shapes

Pieces never turn, and they move as one rigid shape. A piece rises until any block of it touches the ceiling or a stack. It fits only if the whole shape fits, so a shape with a stem needs room for the stem under every part of it. Once it has landed, any block left with a gap above it rises to close the gap.

The shapes live in `src/js/shapes.js` as ASCII art (`#` is a block) with a weight for how often each shows up. There are 14 shapes. Each has 3 or more blocks. Rows are split by `/`.

| Group  | Shapes                                                                         | Weight |
| ------ | ------------------------------------------------------------------------------ | ------ |
| Threes | `###`, `#/#/#`, `##/#.`, `##/.#`, `#./##`, `.#/##`                             | 3      |
| Fours  | `##/##`, `###/.#.`, `.##/##.`, `##./.##`                                       | 3      |
| Fun    | `#.#/###` (U), `###/#.#` (upside-down U), `.#./###/.#.` (plus), `#../##./.##` (stair) | 1 |

The final list and weights can change after a sim run. This table holds the list that ships.

### The secret shape lab

Open `shape-lab.html` on the same site as the game, or tap the version number on the title screen 7 times. Its page title is "Kerplunk shape lab". It is a visual editor:

- Pick a shape, then press or drag squares to add and remove blocks. Flip, turn, add all turns or add the mirror.
- Set the weight and see the chance it shows up.
- The drop test shows where the rigid shape rests on a random board, and shows when it does not fit. Click to drop it and watch the loose blocks rise.
- **Save to game** keeps your list in this browser, and the game uses it the next time it starts. **Back to built-in shapes** removes it.
- **Copy code** or **Download shapes.js** gives you a file to paste over `src/js/shapes.js`, to make the shapes part of the game for everyone.

The lab keeps its list in `glintwell.shapes.v1`. That key keeps its old name, so a list made before 2.0.0 still loads.

## Scoring

Each cleared group scores `blocks × 10 × chain step × group multiplier`.

| Group size | 3 | 4 | 5 | 6 | 7 | 8 | 9+ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Group multiplier | ×1 | ×1 | ×2 | ×3 | ×4 | ×5 | ×6 |

The chain step multiplier is ×1 for the first clear, ×2 for the next, and so on.

## Timed: earn time

A Timed game starts with 60 seconds. Each turn adds time:

| What the turn did                 | Seconds added |
| --------------------------------- | ------------- |
| Its longest chain is 3            | 3             |
| Its longest chain is 4            | 10            |
| Its longest chain is 5 or more    | 15            |
| It cleared a group of 6 or more   | 3 more        |

The clock shows a "+Ns" sticker when it gets time. The time bar fills to 60 seconds at most; the number shows the real time. The seconds are `TIMED_SECONDS` and `TIME_FOR_CHAIN` and `TIME_FOR_BIG_GROUP` in `src/js/engine.js`.

## Power-ups

A turn earns one power-up if it makes a chain of 3 or more steps, or clears one group of 6 or more blocks. Which power-up you get comes from a shuffled deck of all three kinds, so you never get the same one twice in a row.

| Power-up | What it does |
| --- | --- |
| Prism | Paints a tray piece one color. The piece clears itself, plus every block it touches of that color. |
| Blast | Clears a 3×3 area of the well. |
| Remix | The blocks rattle and glow, then every block flies on its own curve to a new cell. The same cells stay filled and every block keeps its color. It avoids leaving a match when it can. |

The numbers are `REWARD_CHAIN`, `REWARD_GROUP`, `GROUP_MULT_FROM` and `GROUP_MULT_MAX` in `src/js/engine.js`.

### In Endless: you tap them

Power-ups wait in a bar under the well (3 at most; a reward that does not fit is lost, and the deck keeps its card). Tap one to use it.

- Prism: pick a color, then a tray piece.
- Blast: touch the well to aim the 3×3 area, let go to clear it.
- Remix: acts at once.

A game is not over while you hold a Blast, since it can clear room.

### In Timed: they act by themselves

Timed has no power-up bar. An earned power-up acts after the turn that earned it (after the tray refills), before the next drop. It plays the same animation as a tapped power-up, with a sticker of its name.

- Prism paints every piece in the tray one color. The engine tries each color: it paints the pieces, and finds the drop of one painted piece that clears the most blocks. The color with the biggest clear wins. On a tie, the first color in the order Ember, Amber, Moss, Tide, Dusk wins.
- Blast clears the 3×3 area with the most blocks. On a tie, the area nearest the tray wins.
- Remix shuffles the well.

A "Start with a power-up" boost acts at the start of a Timed game. Power-ups that the warm-up earns in Timed also act at once.

## The look

Kerplunk has a neo-brutalist look: thick outlines, hard shadows with no blur, flat bold color, and bold type. Every screen uses it, the shape lab too.

- Cards and buttons have an outline and a hard shadow. A tap pushes a card into its shadow.
- A panel opens with a short drop and a hard shadow, with no blur behind it.
- The score card has a small tilt, like a sticker.
- A clear: each block hops up and left, then falls and turns while it shrinks. The blocks go one after the other from the first block of the group. The points show on a tilted sticker that rises and fades.

The look has two parts. The player picks one of each in the shop: a **theme** and a **block style**.

### Themes

A theme is a set of design variables: the CSS custom properties on the page, which the canvas also reads. A new theme changes only the values. The themes live in `src/js/themes.js`.

| Theme  | What it is                                                                                    | Price |
| ------ | --------------------------------------------------------------------------------------------- | ----- |
| Light  | Cream dotted paper `#FFF8E7`, white cards, black ink, a yellow score card and a teal Plunks card. | Free, the default |
| Dark   | Near black `#121212` dotted paper, dark cards, off-white outlines and shadows.                 | ✦150 |
| Random | Each new game rolls a new look inside fixed rules. The look stays the same for the whole game. | ✦300 |

Light values: outline 3px, hard shadow 4px right and 4px down, corner 6px. Block colors: Ember `#FF6B6B`, Amber `#FFD93D`, Moss `#6BCB77`, Tide `#4D96FF`, Dusk `#C084FC`. Dark keeps the same block colors.

A Random roll picks a background, two card colors (never the same as the background, or the same as each other), a well color, one of four block color sets, the display type (Archivo Black or Bricolage Grotesque), the outline, shadow, corner and score tilt. Text on a colored card is black or white, whichever has more contrast. The ink is always `#111111`. When Random is in use, the title screen and the menus keep the look of the last game. The game rolls one look when it opens, if there is none yet.

### Block styles

Each style gives each color a second clue, so the five colors stay different in grayscale. Each block has a 2.5px ink outline. A mark on a block is black or white, whichever has more contrast on that block. The well, the tray, How to play, the shop and the shape lab show the active style. The styles live in `src/js/sprites.js`.

| Style       | Ember | Amber | Moss | Tide | Dusk | Price |
| ----------- | ----- | ----- | ---- | ---- | ---- | ----- |
| Patterns    | diagonal stripes | dots | plain | checks | rings | Free, the default |
| Symbols     | triangle | circle | diamond | square | plus | ✦100 |
| Dice pips   | 1 dot | 2 dots | 3 dots | 4 dots | 5 dots | ✦100 |
| Silhouettes | square | circle | leaf (two round corners) | octagon | arch | ✦150 |
| Faces       | grumpy | happy | sleepy | surprised | wink | ✦250 |

Silhouettes have no mark: the outline of the block is the clue. Each face blinks once every 6 seconds, each at its own moment. A face that clears gets bigger for a moment as it falls. Faces do not react to the game.

### Fonts

| Font                | Used for                                         |
| ------------------- | ------------------------------------------------ |
| Archivo Black       | The logo, the score and the stickers             |
| DM Mono             | Labels, in capitals                              |
| Space Grotesk       | All other text                                   |
| Bricolage Grotesque | The display type of some Random rolls            |

The fonts come from the Fontsource packages (`@fontsource/*`, dev dependencies). `npm run fonts` copies their latin woff2 files to `src/fonts/`. The files in `src/fonts/` are part of the game, and the service worker caches them, so the type shows offline.

## Plunks (the meta currency)

Combos earn Plunks (✦). They are kept between games, shown on the title screen and in the HUD, and saved with the best scores. The names in the code still say `glints`.

| Source | Plunks |
| --- | --- |
| A clear step in a chain | chain step − 1 (so step 2 earns 1, step 3 earns 2) |
| A group of 5 or more | group multiplier − 1 (so 5 blocks earn 1, 6 earn 2) |
| A full clear of the well | 10 |

Things to buy:

| Item | Cost | When | What it does |
| --- | --- | --- | --- |
| Warm-up | 25 | Start of a game | The game plays the first 20 rounds for you. The score and power-ups it earns are yours. Plunks earned during the warm-up are not paid out. |
| Start with a power-up | 20 | Start of a game | Begin with a Prism, Blast or Remix. In Timed it acts at the start. |
| Ban a shape | 30 | Start of a game | Pick one of the 14 shapes. It never shows up this game. |
| Reroll | 10, then +5 each time in a game | Any time (the ↻ button in the HUD), or on the game over screen | Swaps the pieces in the tray for new ones. |
| Second wind | 40 | Game over after running out of room | Clears the bottom 4 rows of the stack and lets you keep playing. Once per game. |
| +15 seconds | 20 | Game over in Timed | Keep playing for 15 more seconds. Once per game. |
| Bigger bag | 150, then 300 | Shop (permanent) | The power-up bag holds 4, then 5. |
| Themes | 150 to 300 | Shop (permanent) | Dark and Random. See "Themes". |
| Block styles | 100 to 250 | Shop (permanent) | Symbols, Dice pips, Silhouettes and Faces. See "Block styles". |

A shop item shows a small preview, its price or "Owned", and "Use" or "In use". A buy with too few Plunks is off. "Use" changes the look at once, on every screen.

When you have Plunks to spend, starting any game opens a "Before you start" box with the three boosts. Pick what you want and press Start, or choose No thanks.

All prices and amounts are constants in `src/js/prices.js`. The prices of the looks are drafts. `npm run sim` prints Plunks earned per 100 turns.

## The save

The save is in local storage under `kerplunk.save.v2`. It holds the best scores, the Plunks, the settings, the Lab, the bag upgrades, the owned themes and the active theme, the owned block styles and the active block style, and the last Random roll.

The game does not read the Glintwell save (`glintwell.save.v1`). A player who played Glintwell starts again with no best scores, no Plunks and no bought items. The custom shapes of the shape lab are kept apart, and stay.

## The daily challenge (hidden)

The title screen has no Daily button, and no game pays a daily bonus. The seed code (`dailySeed` in `src/js/engine.js`) stays for a later puzzle mode.

## Tools

- `npm test` checks the rules on hand-made boards: the engine, the shape list, the bot, the wallet and the Random roll.
- `npm run sim` plays bots and prints game length and how often each chain length happens. Pass a variant name to run one, for example `node tools/sim.js default`.
- `npm run fonts` copies the font files from the Fontsource packages to `src/fonts/`.
- Cheats are on at `localhost` and for any page opened with `?debug`. They are off on a real host. Hold Shift and press `1` Prism, `2` Blast, `3` Remix, `4` all three, `5` drop 50 blocks, `6` fill the well, `7` next Remix style, `8` play that style again, `9` add 100 Plunks, `0` empty the bag.
- In the console, `kerplunk.help()` lists the commands. For example `kerplunk.give('remix', 'blast')`, `kerplunk.remix('swirl')` (add one and fire it in that style; `kerplunk.remixStyles()` lists them), `kerplunk.glints(500)`, `kerplunk.drop(50)`, `kerplunk.fill(0.6)` and `kerplunk.bot(50)`.

## Lab

Settings has a Lab panel to test other sizes. Each one starts with the next game:

1. Grid size: small (6×8), medium (7×9), large (8×10).
2. Pieces per turn: 2 or 3. With 3, the tray refills only when all 3 are used.
