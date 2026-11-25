# Assets

## Cards: Pixel Plebes (Classic)

- Source: `src/assets/Plebes_CLASSIC_4XSheet.png`, by Devlyn JD. The sheet asks for credit, so the game shows it in Settings.
- The game uses `src/assets/plebes-1x.png`: the same sheet at one pixel per art pixel (1260 x 504). It is small and draws crisp at any size. Make it again with `npm run deck`.
- Layout of the sheet: rows are hearts, diamonds, spades, clubs. Columns are A, K, Q, J, 2 to 10, then the back (row 1) and the jokers. Cards sit on a 90 x 126 grid. A card is 88 x 126 from (1, 0): the cream edge, the frame and the rank that pokes out of it. Clear pixels at the grid corners round the corners.

## Adding a deck

A deck lives in `src/themes/themes.ts`.

1. Put the sheet in `src/assets/` and import it.
2. Add a `Deck` of kind `sprite`: the sheet size, the card size, `at(card)` (top-left of a card in the sheet), `back`, and `fanUp` (how much of a card shows in a column; keep the rank and suit visible).
3. Add a `Theme` that uses it, and a `[data-theme='<id>']` block in `src/styles/themes.css` for the felt.

The `vector` deck (Plain) needs no images. It is the fallback, and the easiest to read.

## Sounds

`public/sfx/` holds card sounds from Kenney's Casino Audio pack (CC0, https://kenney.nl/assets/casino-audio). `src/audio/sfx.ts` plays them through a soft low-pass and a small room. The chimes (foundation, hint, win) are made in code. If a browser cannot decode OGG, made-up sounds play instead.

## Fonts

Pixelify Sans (headings, buttons) and Space Grotesk (text), from Fontsource.
