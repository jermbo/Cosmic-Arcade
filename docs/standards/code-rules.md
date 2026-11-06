---
title: Code rules
summary: "The code rules of this project that differ from the baseline of the code-standards skill."
updated: 2026-11-05
---

# Code rules

Each rule that this page does not name stays as the baseline tells it.

## Which files get the frontend rules

Changes: the scope of the frontend rules (`native-first`, `accessible`, `bem`, `tokens`, `intrinsic-layout`, `touch-first`, `content-first`, `long-content`, `motion`).

The frontend rules apply to a screen that HTML and CSS draw. A screen that an engine draws on a canvas, such as Phaser, Three.js or Godot, gets the core rules only. Inside a canvas there is no element, no class and no container query.

A game that mixes the two follows the frontend rules for its HTML parts, such as a menu in the DOM over the canvas.

## Rules of a game project

Changes: where a rule change can live.

A game project can have its own `code-rules.md` in its folder. For the files of that project, it wins over this page and over the baseline. With no such file, the project follows this page.
