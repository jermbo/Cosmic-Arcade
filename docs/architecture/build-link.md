---
name: Build link
description: "How a game entry points to its game project by package name, and how the site catches a broken link."
altitude: part
tags:
  - content
  - build
parent: game-project.md
---

[Wiki](../README.md) / [Game project](game-project.md) / Build link

# Build link

The build link connects a game entry to the game project that makes its build. It uses the package name of the project, not a folder name. Thus you can rename a folder or a slug, and the link still works.

## Why not use folder names

A match by folder name breaks in quiet ways. You rename `games/tower-defense/` to `games/td-phaser/`, and the game is gone from the site with no error. Also, one game can have two projects. You try the same game in Phaser and in Excalibur, and you want to change between them with one line.

## How the link works

The site has a second collection, the builds collection. It reads the `package.json` of each folder in `games/`. Each build has the package `name` as its ID, and the `arcade` block as its data.

The `build` field of a [game entry](game-entry.md) is a reference to an ID in the builds collection:

```typescript
type Build = {
  id: string;        // the package name, such as "@arcade/td-phaser"
  engine: string;    // from arcade.engine
  outDir: string;    // from arcade.outDir, relative to the project folder
  folder: string;    // the project folder, such as "games/td-phaser"
};
```

A reference to an ID that does not exist stops the build of the site. Thus a broken link never reaches the published arcade.

## An example

"Ember Keep" has `build: "@arcade/td-phaser"`. You make a second project, `games/td-excalibur/`, with the name `@arcade/td-excalibur`. To try it, you change one line in the entry:

```yaml
build: "@arcade/td-excalibur"
```

The landing page and its URL stay the same. Only the game behind the Play link changes. If you type `@arcade/td-excalibr`, the site does not build, and the error names the entry.

## Further reading

- [Publishing builds](publishing-builds.md): what the site does with the build after it finds the project.
- [Repo layout](repo-layout.md): where the `games/` folder is.
