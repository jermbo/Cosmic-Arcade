---
title: Design rules
summary: "The token scales and tokenized categories of this project. The code-standards skill reads this page for audits of `tokens`."
updated: 2026-11-05
---

# Design rules

These rules belong to the arcade site only. A game project draws its own look and does not use these tokens. Change them when the owner agrees a new scale or category.

## Files of the variables

| Layer     | Path or note                                      |
| --------- | ------------------------------------------------- |
| Primitive | `src/styles/tokens.css`, the block "Primitive".   |
| Semantic  | `src/styles/tokens.css`, the block "Semantic".    |

## Tokenized categories

| Category    | Tokenized | Notes                                   |
| ----------- | --------- | --------------------------------------- |
| Colour      | Yes       | Light and dark with `light-dark()`.     |
| Type size   | Yes       |                                         |
| Line height | No        | Raw values are permitted.               |
| Space       | Yes       |                                         |
| Corner      | Yes       |                                         |
| Motion      | Yes       | No step yet. Added with the first use.  |

## Scales

Each scale has only the steps that the site uses now. A step comes with its first real use.

### Type size

| Step name       | Maps to    |
| --------------- | ---------- |
| `--text-small`  | `0.875rem` |
| `--text-body`   | `1rem`     |
| `--text-title`  | `2rem`     |

No two steps less than `0.125rem` apart.

### Space

| Step name       | Maps to   |
| --------------- | --------- |
| `--space-small` | `0.5rem`  |
| `--space-body`  | `1rem`    |
| `--space-large` | `2rem`    |

### Corner

| Step name       | Maps to   |
| --------------- | --------- |
| `--corner-card` | `0.5rem`  |

### Colour (semantic)

| Semantic name          | Role in the UI                           |
| ---------------------- | ---------------------------------------- |
| `--color-page`         | The background of each page.             |
| `--color-surface`      | The background of a card or panel.       |
| `--color-text`         | Body text.                               |
| `--color-text-muted`   | Labels and secondary text.               |
| `--color-border`       | The edge of a card.                      |
| `--color-accent`       | Links and the main action, such as Play. |
| `--color-on-accent`    | Text on the accent colour.               |

## Adding a variable

1. **Now**: the value is in a merged or in-review change, or you add it in the same step as its first use.
2. **Known intent**: a story or spec that is in work names the variable or the role it must play. Write the story or spec id on this page or in the commit message.
3. **Not yet**: do not add the variable. Use the nearest step, or a one-off raw value in that component.

## One-offs

A raw value in one component rule is permitted when no other block should share that value and the category is not meant to stay in sync.
