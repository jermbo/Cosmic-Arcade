---
name: Tabletop games
description: "How a tabletop RPG joins the arcade as a game entry with no build."
altitude: part
tags:
  - content
  - tabletop
parent: game-entry.md
---

[Wiki](../README.md) / [Front door](front-door.md) / [Game entry](game-entry.md) / Tabletop games

# Tabletop games

A tabletop game is a game that people play at a table, such as a TTRPG. It has no engine and no build. It joins the arcade as a game entry, like any other game.

## Why tabletop games share the games collection

A tabletop RPG has the same needs as a video game on the arcade: a card in the list, a landing page, a status and a devlog. A second collection would need a second list, a second URL pattern and a second schema. So both kinds are in one collection, and the `kind` field tells them apart.

## How a tabletop entry differs

A tabletop entry has `kind: tabletop`. The schema of a [game entry](game-entry.md) does not let it have a `build`, `platforms` or `inputs`. So the site never makes a play page for it, and the landing page has no Play link.

The body of the entry holds the game itself: the rules, the lore and the links to files that the players download. It uses the same [plain Markdown](content-format.md) as every other entry.

The list of games shows the kind on each card. A visitor sees at once whether a game is played in the browser or at a table.

## An example

"Starfall" is a tabletop RPG. It lives in `src/content/games/starfall/index.md`:

```yaml
title: Starfall
tagline: A crew, a dying star, and three sessions to escape.
status: prototype
kind: tabletop
```

Its landing page is `/games/starfall/`. The body tells the setting, the core rules and the character sheet to download. There is no `/games/starfall/play/`.

## Further reading

- [Game URLs](game-urls.md): the paths that each kind of game gets.
- [Front door](front-door.md): what the site does with every entry.
