---
name: Game project
description: "What a game project must give the arcade, whatever its engine, and what it owns by itself."
altitude: part
tags:
  - games
  - build
parent: ../README.md
---

[Wiki](../README.md) / Game project

# Game project

A game project is the code of one game. It can use any engine. The arcade asks it for only one thing: a folder of static files that runs in a browser.

## Why the contract is so small

You want to try many engines: Phaser, Excalibur, Three.js, plain web pages, and Godot. Godot is not an npm package at all. If the arcade asked for more than a folder of files, some engines could not join. A small contract lets each engine in.

## What a project owns

Each project is an npm workspace in `games/<folder>/`. It owns its engine, its dependencies, its tests and its build. It does not import code from the site or from a different game. When a project needs a helper, it keeps its own copy.

## What a project must give

```json
{
  "name": "@arcade/td-phaser",
  "scripts": {
    "build": "vite build"
  },
  "arcade": {
    "engine": "phaser",
    "outDir": "dist"
  }
}
```

- `name` is unique. A [game entry](game-entry.md) uses it in its [build link](build-link.md) to the project.
- `scripts.build` makes the build. For Godot, this script calls the Godot export.
- `arcade.engine` names the engine, for the list of games.
- `arcade.outDir` is the folder that the build makes. The site [publishes](publishing-builds.md) this folder.

The build in `outDir` must follow three rules:

1. It has an `index.html` at its top.
2. It uses relative paths for its files. The site serves it from `/games/<slug>/play/`, and the project does not know the slug.
3. It has a link to `../`, which opens the landing page of the game. The player gets back to the arcade without the back button of the browser.

## An example

"Ember Keep" lives in `games/td-phaser/`. It is a Phaser game with Vite. Its Vite config sets `base: "./"`, so that all paths are relative. Its pause menu has a link "Back to Ember Keep" to `../`.

## Further reading

- [Front door](front-door.md): what the site does with the build.
- [Repo layout](repo-layout.md): where the projects live next to the site.
