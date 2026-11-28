# Cozy kit

The shared look of the arcade's **cozy puzzle games**: Mozzi, Hueway, Wordkin and Kerplunk. A new cozy game starts here, so its themes, fonts and parts are already done.

It has two parts, and any theme works with any style:

| Part   | What it is | Where |
| ------ | ---------- | ----- |
| Themes | 7 color sets: Oat, Sage, Blossom, Sky (light) and Plum, Tide, Hearth (dark). Oat and Plum are free in every game. | `THEMES` in `themes.js` |
| Styles | **Soft** (soft clay, the default) and **Bold** (neo-brutalist: ink outlines, hard shadows). A free setting in every game. | `STYLES` in `themes.js` |

Each tone (light, dark) has one 10-color palette (`--c0` to `--c9`). The first five (red, blue, yellow, green, purple) stay apart for color-blind players, and dark ink reads on all ten.

## Files

| File | What it holds |
| ---- | ------------- |
| `themes.js` | The data: themes, palettes, styles, and `applyLooks(themeId, styleId)`. Plain JS, so canvas games and Node tests can read it. Types in `themes.d.ts`. |
| `kit.css` | Tokens made from `themes.js`. **Do not edit**: run `npm run css -w @arcade/cozy-kit`. |
| `fonts.css`, `fonts/` | Bricolage Grotesque (Soft), Archivo Black and Space Grotesk (Bold). Latin only, copied from the installed @fontsource packages by `npm run fonts -w @arcade/cozy-kit`. |
| `components.css` | Shared parts that read only kit tokens: page, `.btn`, `.icon-btn`, `.coin-chip`, `.bar`, `.card`, `.sheet-back` + `.sheet`, `.setting` + `.toggle` + `.seg`, `.tabs`, `.badge`, `.row`. Hueway uses them. |
| `scripts/check-colors.js` | The color check (`npm test -w @arcade/cozy-kit`). Mozzi's build runs it too. |

## Use it in a game

1. Add `"@arcade/cozy-kit": "1.0.0"` to the game's `package.json`, then run `npm install` at the repo root.
2. Load the CSS first: `@arcade/cozy-kit/fonts.css`, `@arcade/cozy-kit/kit.css`, and for a new game `@arcade/cozy-kit/components.css`.
3. Call `applyLooks(theme, style)` from `@arcade/cozy-kit/themes.js` whenever either one changes. It sets `data-theme`, `data-tone` and `data-style` on `<html>`, and the browser's theme color.
4. Save `style: 'soft' | 'bold'` in the game's settings (Soft by default), and show it as a free setting.
5. Sell the kit's `THEMES` in the shop, at the game's own prices. Keep an alias map in the save loader if old theme ids exist.
6. Write the game's own parts with kit tokens only, so they follow every theme and both styles.

A game without a bundler (Kerplunk) copies `themes.js`, `fonts.css` and `fonts/` into its own folder: see `games/kerplunk/tools/copy-kit.js`.

## Tokens

| Token | Meaning |
| ----- | ------- |
| `--bg`, `--glow`, `--dot` | The page, its soft glow (Soft) and its dot grid (Bold). Use `background: var(--page-bg)` on the body. |
| `--surface`, `--surface-2` | Cards and buttons; quieter boxes (chips, tabs). |
| `--well`, `--board` | Empty cells, and the board behind them. |
| `--ink`, `--muted`, `--line` | Text, quiet text, thin lines. |
| `--stroke` | Bold outlines and hard shadows. The ink on light themes, near-black on dark ones, so a dark page never gets white outlines. Use `--outline` and `--shade` in parts, not `--stroke` itself. |
| `--accent`, `--accent-ink`, `--accent-soft` | The main button and its text; a soft badge. |
| `--bad`, `--good` | Warnings and good news. |
| `--c0` … `--c9`, `--on-color` | The palette, and dark text on it. |
| `--edge`, `--drop`, `--shine` | Soft clay shadows and the shine on top. |
| `--bw`, `--outline` | Outline width and color: stroke in Bold, clear in Soft. |
| `--shadow`, `--shadow-sm`, `--shadow-lg`, `--shadow-press`, `--press` | Shadows and the pressed move, per style. |
| `--shade`, `--sx` | The hard-shadow color, and the sideways factor (1 in Bold, 0 in Soft): write `calc(4px * var(--sx)) 4px 0 var(--shade)`. |
| `--r-lg`, `--r`, `--r-sm` | Corner radii. |
| `--font-display`, `--display-weight`, `--display-spacing`, `--font-ui` | Fonts. Archivo Black has only weight 400, so always pair the display font with `--display-weight`. |

## Change a theme or the palette

Edit `themes.js`, then run `npm run css -w @arcade/cozy-kit` and `npm test -w @arcade/cozy-kit`. Copy it into Kerplunk with `npm run kit -w kerplunk` (its build does this too). Each game's own checks (Wordkin's contrast check, Kerplunk's theme test) use the kit's values.
