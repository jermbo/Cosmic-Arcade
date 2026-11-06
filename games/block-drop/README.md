# Glintwell

A color-matching puzzle game. Drag glass pieces up from the tray into the well. They rise and stick to the ceiling. Link 3 or more blocks of one color (side to side, bends allowed, never diagonal) and chain the clears. Long chains earn power-ups.

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

- Touch or mouse: drag a piece from the tray into the well. Tap a piece to turn it.
- Keyboard: `←` `→` move, `↑` turn, `↓` or `Tab` next piece, `Space` drop, `Esc` or `P` pause.

## Power-ups

A chain is the number of clear steps in one turn. The highest tier a chain reaches gives one power-up. They wait in a bar under the well (3 at most; a reward that does not fit is lost). Tap one to use it.

| Power-up | Chain | What it does |
| --- | --- | --- |
| Prism | 3 | Pick a color, then a tray piece. The piece turns that one color (it clears itself, plus every block it touches of that color). |
| Blast | 5 | Touch the well to aim a 3×3 area, let go to clear it. |
| Remix | 7 | Mixes the colors of every block. Blocks stay where they are. It avoids leaving a match when it can. |

The chain numbers are in `CHAIN_REWARDS` in `src/js/engine.js`. The design asked for 5 / 8 / 10, but `npm run sim` shows chains that long almost never happen with linked matches, so the play-test build uses 3 / 5 / 7.

A game is not over while you hold a Blast, since it can clear room.

## Tools

- `npm test` checks the rules on hand-made boards.
- `npm run sim` plays bots and prints game length and how often each chain length happens. Pass a variant name to run one, for example `node tools/sim.js default`.
- Add `?debug` to the URL, then in the console: `glintwell.give('prism', 'blast', 'remix')` fills the bag, and `glintwell.bot(50)` plays 50 moves.

## Lab

Settings has a Lab panel to test other sizes. Each one starts with the next game:

1. Grid size: small (6×8), medium (7×9), large (8×10).
2. Pieces per turn: 2 or 3.
