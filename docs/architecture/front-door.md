---
name: Front door
description: "What the Astro site of the arcade does, and what it leaves to the games."
altitude: part
tags:
  - site
  - astro
parent: ../README.md
---

[Wiki](../README.md) / Front door

# Front door

The front door is the Astro site of the arcade. It lists every game, gives each game a landing page, and publishes the builds. It never runs or imports the code of a game.

## Why the site knows nothing about engines

Each game picks its own engine. If the site imported game code, each engine would add its packages, its build steps and its bugs to the site. One broken game would then break the arcade.

So the site and the games share no code. The only thing that goes from a game to the site is a folder of static files. The site does not look inside that folder.

## What the site does

The site reads one [game entry](game-entry.md) for each game. From these entries it makes three kinds of pages:

- A list of all games, with a card for each one.
- A landing page for each game, made from the Markdown of its entry.
- A play page, which is the build of the game itself.

The [game URLs](game-urls.md) page gives the path of each kind.

When an entry points to a build, the site [publishes the build](publishing-builds.md) next to the landing page. The landing page then shows a Play link.

## What the site leaves to the games

The game decides its engine, its input, its saves and its tests. The game also gives the player a way back to the arcade.

## Why a game opens on its own page

The play page is a full page, not a frame inside the landing page. A frame and its parent page compete for the keyboard, the focus and the audio. A full page gives all of them to the game.

For example, "Ember Keep" is a tower defense game. Its card shows on the list of games. Its landing page at `/games/ember-keep/` has the design notes and a Play link. The Play link opens `/games/ember-keep/play/`, and the game fills the window.

## Further reading

- [Repo layout](repo-layout.md): where the files of the site live.
- [Game project](game-project.md): what each game gives the site.
