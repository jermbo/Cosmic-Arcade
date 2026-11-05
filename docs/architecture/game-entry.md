---
name: Game entry
description: "What a game entry in the games collection holds: the metadata that registers a game, and the landing page in its body."
altitude: part
tags:
  - site
  - content
parent: front-door.md
---

[Wiki](../README.md) / [Front door](front-door.md) / Game entry

# Game entry

A game entry registers one game in the arcade. It is a Markdown file in the games collection of the site. Its metadata tells the site what the game is. Its body is the landing page of the game.

## Why a game starts as a page

A game often starts as an idea, long before it has code. The entry lets the idea have a home at once: design notes, sketches and a devlog. When a build comes, the entry gets one more field. Nothing else moves.

## Where an entry lives

Each entry is a folder in `src/content/games/`, with an `index.md` file and its images. The name of the folder is the slug: the name of the game in its URL. The body uses [plain Markdown](content-format.md).

## The metadata of an entry

```typescript
type GameEntry = {
  title: string;
  tagline: string;          // one line for the card
  status: "idea" | "prototype" | "playable" | "released";
  cover?: string;           // an image in the entry folder
  tags?: string[];
} & (
  | {
      kind: "video";
      build?: string;       // package name of the game project
      platforms?: ("desktop" | "mobile")[];
      inputs?: ("keyboard" | "mouse" | "touch" | "gamepad")[];
    }
  | { kind: "tabletop" }
);
```

- A video game with a `build` must give `platforms` and `inputs`. The player must know if the game works on their device before they click Play.
- The `build` field uses the [build link](build-link.md), not a folder name.
- A [tabletop game](tabletop-games.md) has no build.

## An example

"Ember Keep" lives in `src/content/games/ember-keep/index.md`:

```yaml
title: Ember Keep
tagline: Hold the keep for one more night.
status: playable
kind: video
build: "@arcade/td-phaser"
platforms: [desktop]
inputs: [mouse, keyboard]
```

The body below this metadata tells the pitch, the design and the devlog.

## Further reading

- [Game URLs](game-urls.md): how the slug becomes the address of the landing page.
- [Game project](game-project.md): what the package that `build` names must give.
