---
name: Game URLs
description: "The paths that the arcade publishes for each game, where each one comes from, and why they must not change."
altitude: part
tags:
  - site
  - urls
parent: front-door.md
---

[Wiki](../README.md) / [Front door](front-door.md) / Game URLs

# Game URLs

The arcade publishes three paths for games. Each path comes from the slug of a game: the name of the folder of its entry. People share these paths, so a path must not change after it is published.

## The three paths

| Path                   | What it shows                     | Who makes it                 |
| ---------------------- | --------------------------------- | ---------------------------- |
| `/games/`              | The list of all games             | An Astro page                |
| `/games/<slug>/`       | The landing page of one game      | An Astro page from the entry |
| `/games/<slug>/play/`  | The game itself                   | The copied build             |

The slug comes from the folder of the [game entry](game-entry.md), not from the game project. Thus the URL and the code have names that do not depend on each other.

## Why every path ends with a slash

A build uses relative paths for its files. In `/games/ember-keep/play/`, the path `./main.js` opens `/games/ember-keep/play/main.js`. Without the last slash, the same path opens `/games/ember-keep/main.js`, and the game does not load.

So the site sets a trailing slash on every path. The host must send a path with no slash to the same path with a slash.

## Why a path must not change

A path that people share is a promise. When you rename a slug, each old link breaks. So a slug is fixed when its game is published. If a slug must change, the old path sends the visitor to the new one.

The slug does not depend on the engine or on the project. You can move "Ember Keep" from Phaser to Excalibur, and `/games/ember-keep/` stays the same.

## Headers for one game

Some builds need special headers from the host. Godot builds with threads need COOP and COEP headers. The host sets these headers on the play path of that game only, such as `/games/my-jrpg/play/*`. The rest of the site does not get them.

## Further reading

- [Publishing builds](publishing-builds.md): how the build gets to the play path.
- [Build link](build-link.md): how an entry finds its project without folder names.
