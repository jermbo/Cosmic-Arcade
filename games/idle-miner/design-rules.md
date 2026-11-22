---
title: Design rules of Idle Orbit
summary: "The token scales and tokenized categories of the HTML parts of Idle Orbit. The code-standards skill reads this page for audits of `tokens`."
updated: 2026-11-09
---

# Design rules of Idle Orbit

These rules belong to the HTML parts of this game only: the HUD, the toolbar, the cards and the panels. They do not use the tokens of the arcade. Change them when the owner agrees a new scale or category.

The canvas draws its own colours, in `src/view/draw.ts` and in the content data. The canvas gets the core rules only, so this page does not apply there.

## Files of the variables

| Layer     | Path or note                                           |
| --------- | ------------------------------------------------------ |
| Primitive | `src/style.css`, the block "Primitive" in `:root`.     |
| Semantic  | `src/style.css`, the block "Semantic" in `:root`.      |

Today `:root` is one block, and the components use the hue names, such as `--cyan`. The audit of `tokens` divides the block and moves the components to the semantic names.

The layout variables `--safe-*` and `--play-*` are not tokens. They tell where the screen is free, and `main.ts` sets `--play-*`.

## Tokenized categories

| Category    | Tokenized | Notes                                                        |
| ----------- | --------- | ------------------------------------------------------------ |
| Colour      | Yes       | Dark only. The game has no light theme.                      |
| Type size   | Yes       | The logo on the title screen is a one-off `clamp()`.         |
| Line height | No        | Raw values are permitted.                                    |
| Space       | Yes       | A border width is not space. `1px` and `2px` lines stay raw. |
| Corner      | Yes       | A circle (`50%`) is a shape, not a step, and stays raw.      |
| Motion      | Yes       | A loop that runs for a long time, such as a glow, is a one-off. |

## Scales

Each scale is the target. Today the CSS has more values than the scale. A raw value that moves to a different step changes the look, so the audit gives it to the owner as a note, not as a fix.

### Type size

| Step name      | Maps to |
| -------------- | ------- |
| `--text-small` | `12px`  |
| `--text-body`  | `14px`  |
| `--text-large` | `17px`  |
| `--text-title` | `20px`  |
| `--text-big`   | `38px`  |

No two steps less than `2px` apart.

### Space

| Step name       | Maps to |
| --------------- | ------- |
| `--space-tight` | `4px`   |
| `--space-small` | `8px`   |
| `--space-body`  | `12px`  |
| `--space-large` | `16px`  |
| `--space-wide`  | `24px`  |

The steps are on a grid of `4px`.

### Corner

| Step name        | Maps to |
| ---------------- | ------- |
| `--corner-small` | `6px`   |
| `--corner-card`  | `12px`  |
| `--corner-sheet` | `18px`  |
| `--corner-pill`  | `999px` |

### Motion

| Step name       | Maps to                          |
| --------------- | -------------------------------- |
| `--motion-fast` | `0.12s`                          |
| `--motion-base` | `0.2s`                           |
| `--motion-slow` | `0.35s`                          |
| `--ease-pop`    | `cubic-bezier(0.2, 1.4, 0.4, 1)` |

### Colour (semantic)

| Semantic name           | Role in the UI                                          | Today         |
| ----------------------- | ------------------------------------------------------- | ------------- |
| `--color-page`          | The background behind the canvas.                       | `--ink`         |
| `--color-surface`       | The background of a card, a bar or a panel.             | `--panel`       |
| `--color-surface-solid` | A surface that must hide the canvas below it.           | `--panel-solid` |
| `--color-border`        | The edge of a card or a row.                            | `--line`        |
| `--color-border-strong` | The edge of a control or of the selected item.          | `--line-strong` |
| `--color-text`          | Body text.                                              | `--text`        |
| `--color-text-muted`    | Labels and secondary text.                              | `--muted`       |
| `--color-accent`        | The focus ring, the active tool, and the main action.   | `--cyan`        |
| `--color-money`         | Credits and prices.                                     | `--gold`        |
| `--color-highlight`     | A thing that is new, the title, and stardust.           | `--pink`        |
| `--color-good`          | A goal that is done, and a fix.                         | `--green`       |
| `--color-warning`       | A line of belts that is slow.                           | `--amber`       |
| `--color-danger`        | A line that is stuck, a price you cannot pay, and remove. | `--red`       |

## Adding a variable

1. **Now**: the value is in a merged or in-review change, or you add it in the same step as its first use.
2. **Known intent**: a story or spec that is in work names the variable or the role it must play. Write the story or spec id on this page or in the commit message.
3. **Not yet**: do not add the variable. Use the nearest step, or a one-off raw value in that component.

## One-offs

A raw value in one component rule is permitted when no other block should share that value and the category is not meant to stay in sync.
