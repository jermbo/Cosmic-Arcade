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
  css/                   styles, one file for each block (css/labs/ for the lab pages)
  fonts/                 the woff2 files of the four fonts (see "Fonts")
  js/                    game code (ES modules, see "The code")
  icons/                 192, 512, maskable 192 and 512, Apple touch icon, favicons
  labs/                  the secret lab pages: shape lab, feel lab, sound path
```

`npm run build` copies `src/` to `dist/` for the arcade site. The files are the same.

`src/` is not the usual "source code to build" folder. This game has no build step, so `src/` is the website itself, as it goes on the host.

## The code

The game starts in `src/js/main.js`. Each folder of `src/js/` has one job:

| Folder     | What it does                                                                                     | Start with           |
| ---------- | ------------------------------------------------------------------------------------------------ | -------------------- |
| `rules/`   | The game rules. No page code, so they also run in Node for the tests and the sim.                | `game.js`            |
| `play/`    | A game running in the page: the session, one move, power-ups, second chances, the end of a game. | `move.js`            |
| `view/`    | Drawing the game on the canvas, and the animations.                                              | `view.js`            |
| `screens/` | The HTML screens: title, HUD, boosts, shop, settings, tutorial, game over.                       | `title.js`           |
| `input/`   | Touch and mouse, keyboard, buttons, and the cheats.                                              | `pointer.js`         |
| `audio/`   | Every sound, made in the browser with the Web Audio API.                                         | `sound-player.js`    |
| `feel/`    | The numbers behind the motion and the sound, and the sound and animation styles the shop sells.  | `default-tuning.js`  |
| `looks/`   | The themes, and putting the theme on the page.                                                   | `themes.js`          |
| `shop/`    | Prices, the wallet rules and the shop items.                                                     | `prices.js`          |
| `app/`     | Page plumbing: storage, install, updates, small DOM helpers, the version.                        | `storage.js`         |
| `labs/`    | The code of the three lab pages. It is not part of the game.                                     | `lab-page.js`        |

A good path to learn the game: `rules/game.js` (the board and a turn), then `play/move.js` (one move in the page, step by step), then `view/view.js` (how it is drawn).

The code follows the rules in [code-rules.md](code-rules.md).

## Host it on a static HTTPS site

Service workers and install need HTTPS (or `localhost`). Any static host works: GitHub Pages, Netlify, Cloudflare Pages, Vercel, S3, or your own server.

1. Upload the contents of `src/` to a folder on the host. It can be the site root or a sub-folder. All paths are relative.
2. Open the URL over HTTPS once. The service worker caches every file, the fonts too.
3. Turn off the network and reload. The game still loads and plays.

Server notes:

- Serve `manifest.webmanifest` as `application/manifest+json` (most hosts do this already).
- Do not cache `sw.js` for a long time. A short cache or `no-cache` is best. The page also asks for updates with `updateViaCache: 'none'`.

## Release an update

1. Change `VERSION` in `src/sw.js` and in `src/js/app/version.js` (keep them the same). This version is `2.0.0`.
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

The shapes live in `src/js/rules/shapes/shape-art.js` as ASCII art (`#` is a block) with a weight for how often each shows up. There are 14 shapes. Each has 3 or more blocks. Rows are split by `/`.

| Group  | Shapes                                                                         | Weight |
| ------ | ------------------------------------------------------------------------------ | ------ |
| Threes | `###`, `#/#/#`, `##/#.`, `##/.#`, `#./##`, `.#/##`                             | 3      |
| Fours  | `##/##`, `###/.#.`, `.##/##.`, `##./.##`                                       | 3      |
| Fun    | `#.#/###` (U), `###/#.#` (upside-down U), `.#./###/.#.` (plus), `#../##./.##` (stair) | 1 |

The final list and weights can change after a sim run. This table holds the list that ships.

### The secret shape lab

Open `labs/shape-lab.html` on the same site as the game, or tap the version number on the title screen 7 times. Its page title is "Kerplunk shape lab". It is a visual editor:

- Pick a shape, then press or drag squares to add and remove blocks. Flip, turn, add all turns or add the mirror.
- Set the weight and see the chance it shows up.
- The drop test shows where the rigid shape rests on a random board, and shows when it does not fit. Click to drop it and watch the loose blocks rise.
- **Save to game** keeps your list in this browser, and the game uses it the next time it starts. **Back to built-in shapes** removes it.
- **Copy code** or **Download shape-art.js** gives you a file to paste over `src/js/rules/shapes/shape-art.js`, to make the shapes part of the game for everyone.

The lab keeps its list in `glintwell.shapes.v1`. That key keeps its old name, so a list made before 2.0.0 still loads.

### The sound path

Open `labs/sound-path.html`, or follow the link in the feel lab. Its page title is "Kerplunk sound path". It builds the sound of the game one decision at a time. Each step plays its options with what the steps before it locked in.

- The step buttons at the top show where you are. A step opens when the step before it is locked in. After **Lock it in**, **Next →** goes on. The page keeps which steps are done in `kerplunk.soundpath.v1`. A "Built on" tag shows what the earlier steps locked in.
- **Step 1, the drop:** pick the instrument body. Each card has a picture of a real drop, a few words for it (how long it rings, how bright it is), and buttons to hear a drop, a clear and a chain.
- **Step 2, the clear:** pick a mood (Happy, Sunny, Magic, Moody, Cheeky: each is a scale), then how a clear plays its notes: Rise (the sound today), Strum, Sparkle, Hop, Bounce, Cascade or Chord. Each card draws its notes as blocks: time to the right, pitch up. Faded blocks play only on a group of 4 or more.
- **Step 3, the chain:** pick how a chain builds: Climb (the sound today: one note higher each step), Leap (two notes), Stack (one more note each step), Shine (a sparkle from step 3) or Swell (louder, with more echo). Each card draws chain steps 1 to 4.
- **Step 4, power-ups and big moments:** earned, Blast, Remix, all clear, game over and new best. Sets: Today, Your instrument, Cartoon (laser Blast, slide-whistle Remix, coin blips), Arcade (8-bit) and Magic (glass bells and music box).
- **Step 5, the small sounds:** a button tap, picking up, moving, "no" and the clock tick. Sets: Today, Soft (your instrument, quiet), Clicky, Bubbly, Cartoon and Hush.
- **Your sound** sums up every pick, with a **Change** button for each, a demo of the whole sound, and **Copy settings**.
- The picture at the top shows the sound live: the wave, and the spectrum from low to high notes. The card pictures come from playing the real sound into a buffer.
- **Lock it in** saves the pick in this browser (in `kerplunk.tuning.v1`), and the game plays with it.

The styles, sets and moods live in `src/js/feel/sound-styles.js` (`CLEAR_STYLES`, `CHAIN_STYLES`, `POWER_STYLES`, `SMALL_STYLES`, `MOODS`). The notes of a clear are planned in `src/js/audio/clear-chime.js` (`planClear`), and the sounds of the sets are in `src/js/audio/power-sound-sets.js` and `src/js/audio/small-sound-sets.js`. The Feel Lab's Sound tab has the same picks.

The bodies live in `src/js/audio/instrument-bodies.js`. Each one is a short recipe of layered tones, noise and plucked strings. "Wooden (now)" is the built-in sound. The others: Bubble, Woodblock, Soft pluck, Glass bell, Kalimba, Tongue drum, Music box, Steel drum, Vibraphone, Felt piano, Koto, Raindrop, Toy piano, Ocarina and Clay pot, and the cartoon ones: Space laser, Zap, Whap, Boing, Cork pop, Squeak, Slide whistle and Coin blip.

### The secret feel lab

Open `labs/feel-lab.html`, or follow the link in the shape lab. Its page title is "Kerplunk feel lab". It tunes how the game moves and sounds:

- **The stage** plays one moment of the game again and again: Drop, Clear, Chain, Big group, Blast, Remix or Power-up. It uses the real view, engine and effects, so what you see is what the game does. Play it at 1×, ½× or ¼× (the sound stays at normal speed), and pick a block style. Tap the stage, or press Space, to play it again. **New board** finds a new board for the scene.
- **Motion** has knobs for the landing, the clear, the shake, the stickers and the Remix style.
- **Sound** has knobs for the mix, the echo, the wooden bar, the plunk, the clear chime (its scale and first note), the landing thud and the music. Under them, each game sound has a play button and its own volume, pitch and length. **Chain climb** plays the clear chime of chains 1 to 8.
- Each tab has presets (Motion: Snappy, Bouncy, Heavy, Floaty. Sound: Glassy, Soft, Punchy, Chiptune, Dreamy) and **Compare with built-in**, which swaps between your values and the built-in ones.
- A changed value is marked. Tap it to put that knob back.
- **Save to game** keeps your feel in this browser, and the game uses it the next time it starts. **Back to built-in** removes it.
- **Copy settings** gives the changed values as JSON. Put them in `DEFAULT_TUNING` in `src/js/feel/default-tuning.js` to make them the feel for everyone.

The Sound tab has a live picture of the sound, and its **Body** menu picks the instrument (see "The sound path").

All the numbers live in `src/js/feel/default-tuning.js`. The sounds, shakes and stickers of a move live in `src/js/play/juice.js`, which the game and the lab share. The lab keeps your feel in `kerplunk.tuning.v1`. The labs are not cached for offline play.

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

The clock shows a "+Ns" sticker when it gets time. The time bar fills to 60 seconds at most; the number shows the real time. The seconds are `TIMED_SECONDS` and `TIME_FOR_CHAIN` and `TIME_FOR_BIG_GROUP` in `src/js/rules/timed-mode.js`.

## Power-ups

A turn earns one power-up if it makes a chain of 3 or more steps, or clears one group of 6 or more blocks. Which power-up you get comes from a shuffled deck of all three kinds, so you never get the same one twice in a row.

| Power-up | What it does |
| --- | --- |
| Prism | Paints a tray piece one color. The piece clears itself, plus every block it touches of that color. |
| Blast | Clears a 3×3 area of the well. |
| Remix | The blocks rattle and glow, then every block flies on its own curve to a new cell. The same cells stay filled and every block keeps its color. It avoids leaving a match when it can. |

The numbers are `REWARD_CHAIN` and `REWARD_GROUP` in `src/js/rules/power-ups.js`, and `GROUP_MULT_FROM` and `GROUP_MULT_MAX` in `src/js/rules/scoring.js`.

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

- The logo spells KERPLUNK in letter tiles, one block color each. The ink on a tile is black or white, whichever has more contrast, so the name reads in every theme. The tiles drop in, then a hop runs along the name now and then.
- Cards and buttons have an outline and a hard shadow. A tap pushes a card into its shadow.
- A panel opens with a short drop and a hard shadow, with no blur behind it.
- The score card has a small tilt, like a sticker.
- A clear: each block hops up and left, then falls and turns while it shrinks. The blocks go one after the other from the first block of the group. The points show on a tilted sticker that rises and fades.

Small touches:

- A tap on a logo tile makes it hop and play its note. With Random in use, a tap rolls a new look.
- A dropped piece lands with a squash, a soft thud and a tiny shake of the well.
- On the game over screen the score counts up. A new best gets a "New best" sticker stamped on the score card.
- The pictures of How to play move: a piece rises and sticks, a group hops and clears, the power-ups hop, the warning pulses.
- In small or mono type, the ✦ of Plunks is bold and a little bigger, so it does not read as a "+". The points sticker says "+2 Plunks" in words.
- The sounds are wooden: a marimba note and a round "plunk" in place of glass bells.

The look has two parts. The player picks one of each in the shop: a **theme** and a **block style**.

### Themes

A theme is a set of design variables: the CSS custom properties on the page, which the canvas also reads. A new theme changes only the values. The themes live in `src/js/looks/themes.js`.

| Theme  | What it is                                                                                    | Price |
| ------ | --------------------------------------------------------------------------------------------- | ----- |
| Light  | Cream dotted paper `#FFF8E7`, white cards, black ink, a yellow score card and a teal Plunks card. | Free, the default |
| Dark   | Near black `#121212` dotted paper, dark cards, off-white outlines and shadows.                 | ✦150 |
| Random | Each new game rolls a new look inside fixed rules. The look stays the same for the whole game. | ✦300 |

Light values: outline 3px, hard shadow 4px right and 4px down, corner 6px. Block colors: Ember `#FF6B6B`, Amber `#FFD93D`, Moss `#6BCB77`, Tide `#4D96FF`, Dusk `#C084FC`. Dark keeps the same block colors.

A Random roll picks a background, two card colors (never the same as the background, or the same as each other), a well color, one of four block color sets, the display type (Archivo Black or Bricolage Grotesque), the outline, shadow, corner and score tilt. Text on a colored card is black or white, whichever has more contrast. The ink is always `#111111`. When Random is in use, the title screen and the menus keep the look of the last game. The game rolls one look when it opens, if there is none yet. In the shop, Random in use has a **New look** button: each tap rolls a new look at once, for free. A new roll always has another background than the last one.

### Block styles

Each style gives each color a second clue, so the five colors stay different in grayscale. Each block has a 2.5px ink outline. A mark on a block is black or white, whichever has more contrast on that block. The well, the tray, How to play, the shop and the shape lab show the active style. The styles live in `src/js/view/sprites/` (`block-sprites.js` draws a block, `block-marks.js` draws the mark of each style).

| Style       | Ember | Amber | Moss | Tide | Dusk | Price |
| ----------- | ----- | ----- | ---- | ---- | ---- | ----- |
| Patterns    | diagonal stripes | dots | plain | checks | rings | Free, the default |
| Symbols     | triangle | circle | diamond | square | plus | ✦100 |
| Dice pips   | 1 dot | 2 dots | 3 dots | 4 dots | 5 dots | ✦100 |
| Silhouettes | square | circle | leaf (two round corners) | octagon | arch | ✦150 |
| Faces       | grumpy | happy | sleepy | surprised | wink | ✦250 |

Silhouettes have no mark: the outline of the block is the clue. Each face blinks once every 6 seconds, each at its own moment. A face that clears gets bigger for a moment as it falls. Faces do not react to the game.

### Sound profiles

A sound profile is a whole matched set: the instrument of every note, how a clear plays, the mood (the scale), how a chain builds, the power-up sounds and the small sounds. The player picks one in the shop, like a theme. **▶ Hear it** plays a drop, a chain of 3 and a power-up earned. The profiles live in `src/js/feel/sound-profiles.js`, and their parts in `src/js/audio/` and `src/js/feel/sound-styles.js` (see "The sound path").

| Profile     | Instrument  | Clear   | Mood   | Chain | Power-ups       | Small sounds | Price |
| ----------- | ----------- | ------- | ------ | ----- | --------------- | ------------ | ----- |
| Wooden      | as tuned (the wooden bar) | as tuned | as tuned | as tuned | as tuned | as tuned | Free, the default |
| Bubbles     | Bubble      | Hop     | Happy  | Climb | Your instrument | Bubbly       | ✦100 |
| Thumb piano | Kalimba     | Strum   | Happy  | Shine | Your instrument | Soft         | ✦100 |
| Woodshop    | Woodblock   | Rise    | Cheeky | Leap  | Your instrument | Clicky       | ✦100 |
| Music box   | Music box   | Sparkle | Magic  | Shine | Magic           | Soft         | ✦150 |
| Glass       | Glass bell  | Rise    | Magic  | Swell | Magic           | Soft         | ✦150 |
| Island      | Steel drum  | Bounce  | Sunny  | Leap  | Your instrument | Clicky       | ✦150 |
| Cozy keys   | Felt piano  | Chord   | Sunny  | Stack | Your instrument | Hush         | ✦150 |
| Zen         | Koto        | Strum   | Moody  | Shine | Magic           | Hush         | ✦150 |
| Cartoon     | Boing       | Bounce  | Cheeky | Leap  | Cartoon         | Cartoon      | ✦200 |
| Arcade      | Coin blip   | Sparkle | Sunny  | Leap  | Arcade          | Soft         | ✦200 |
| Space       | Space laser | Cascade | Moody  | Swell | Arcade          | Hush         | ✦250 |

Wooden plays the tuning the game loaded: the built-in sound, or what the Sound Path or the feel lab saved in this browser. The other profiles set their six parts on top of it. The volume, the echo and the landing thud stay as tuned.

### Animation styles

An animation style sets how blocks move: how fast they rise, how much they squash, how a clear hops and falls, and how much the well shakes. The player picks one in the shop. Its preview is a tiny well that loops a block landing and a clear in that style. The styles live in `src/js/feel/motion-styles.js`, and the feel lab uses them as its motion presets.

| Style   | What it is | Price |
| ------- | ---------- | ----- |
| Classic | A firm squash and a quick hop. Plays the motion as tuned. | Free, the default |
| Snappy  | Fast and crisp. Blocks rise quickly and clears are short. | ✦100 |
| Bouncy  | Soft and springy. Blocks squish and wobble back. | ✦150 |
| Heavy   | Big thumps and shakes. Cleared blocks drop like stones. | ✦150 |
| Floaty  | Slow and dreamy. Blocks drift and twirl away. | ✦150 |

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
| Sound profiles | 100 to 250 | Shop (permanent) | 11 matched sets of sounds. See "Sound profiles". |
| Animation styles | 100 to 150 | Shop (permanent) | Snappy, Bouncy, Heavy and Floaty. See "Animation styles". |

A shop item shows a small preview, its price or "Owned", and "Use" or "In use". A buy with too few Plunks is off. "Use" changes the look at once, on every screen.

When you have Plunks to spend, starting any game opens a "Before you start" box with the three boosts. Pick what you want and press Start, or choose No thanks.

All prices and amounts are constants in `src/js/shop/prices.js`. The prices of the looks are drafts. `npm run sim` prints Plunks earned per 100 turns.

## The save

The save is in local storage under `kerplunk.save.v2`. It holds the best scores, the Plunks, the settings, the Lab, the bag upgrades, the owned themes and the active theme, the owned block styles and the active block style, the owned sound profiles and the active one, the owned animation styles and the active one, and the last Random roll.

The game does not read the Glintwell save (`glintwell.save.v1`). A player who played Glintwell starts again with no best scores, no Plunks and no bought items. The custom shapes of the shape lab are kept apart, and stay.

## The daily challenge (hidden)

The title screen has no Daily button, and no game pays a daily bonus. The seed code (`dailySeed` in `src/js/rules/random.js`) stays for a later puzzle mode.

## Tools

- `npm test` runs every `tools/*-test.js` file with Node's test runner: the engine, the shape list, the bot, the wallet, the Random roll, and the sound profiles and animation styles. A new test file only needs a name that ends in `-test.js`.
- `npm run sim` plays bots and prints game length and how often each chain length happens. Pass a variant name to run one, for example `node tools/sim.js default`.
- `npm run fonts` copies the font files from the Fontsource packages to `src/fonts/`.
- Cheats are on at `localhost` and for any page opened with `?debug`. They are off on a real host. Hold Shift and press `1` Prism, `2` Blast, `3` Remix, `4` all three, `5` drop 50 blocks, `6` fill the well, `7` next Remix style, `8` play that style again, `9` add 100 Plunks, `0` empty the bag.
- In the console, `kerplunk.help()` lists the commands. For example `kerplunk.give('remix', 'blast')`, `kerplunk.remix('swirl')` (add one and fire it in that style; `kerplunk.remixStyles()` lists them), `kerplunk.glints(500)`, `kerplunk.drop(50)`, `kerplunk.fill(0.6)` and `kerplunk.bot(50)`.

## Lab

Settings has a Lab panel to test other sizes. Each one starts with the next game:

1. Grid size: small (6×8), medium (7×9), large (8×10).
2. Pieces per turn: 2 or 3. With 3, the tray refills only when all 3 are used.
