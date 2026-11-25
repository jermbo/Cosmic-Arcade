# Solitary — architecture

## Layers

```
main.ts
  └─ App          title screen, dialogs, navigation
       └─ GameView   HUD, input, session wiring
            └─ Board     layout, DOM cards, motion
```

| Layer | Folder / file | Responsibility |
|-------|----------------|----------------|
| Pure game | `core/`, `rules/` | Cards, state, legal moves, hints. No DOM, no settings. |
| Game run | `game/session.ts` | One deal: undo stack, timer, save, auto-move. No DOM. |
| Layout math | `ui/layout.ts` | Card size and each pile’s `{ x, y }` on the table. |
| Table DOM | `ui/board.ts` | Card elements, `cardPosition()`, render motion, highlights. |
| Play screen | `ui/game-view.ts` | Pointer + keyboard → `Session.move()`. |
| Shell | `ui/app.ts` | Title, pause, win, settings, history. |

## Key types

- **`State`** — `piles['t0']`, `piles['stock']`, etc. Each pile is face-up/down slots with card ids.
- **`CardRef`** — `{ pile, index }` — which card in the state (not a screen coordinate).
- **`Layout`** — `piles[id]` = top-left of that pile in **table pixels**. Stacked cards add offset in `Board.cardPosition()`.
- **`RenderMode`** — `'instant' \| 'animate' \| 'deal'` — how cards move when state changes.

## Pile ids

| Pattern | Meaning |
|---------|---------|
| `stock`, `waste` | Klondike / Spider stock |
| `f0` … `f7` | Foundations |
| `t0` … `t9` | Tableau columns |
| `c0` … `c3` | FreeCell cells |

## Tests

`npm test` — bot plays via hints; checks no cards are lost. Rules-only; UI is not covered.

## Naming conventions (for contributors)

- No single-letter variables except loop indices and `x` / `y` in geometry.
- `CardRef` for a card in a pile; `Point` / `cardPosition()` for screen placement.
- `updateHighlights()` on the board (targets, hint, focus ring) — not “decorate”.
- `Rules.cardLabel(id)` — short text like `A♠` for speech and HUD.