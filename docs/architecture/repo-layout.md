---
name: Repo layout
description: "Where the site, the game projects, the published builds and the docs live in the repo, and why."
altitude: part
tags:
  - repo
  - npm
parent: ../README.md
---

[Wiki](../README.md) / Repo layout

# Repo layout

The repo holds the site, all the game projects and this wiki. The site is at the root. Each game project is in a folder of its own under `games/`.

## Why one repo

Each game is separate in its code, but the arcade publishes all of them together. One repo gives one `npm install`, one build of the site and one history. The site can also check each build link when it builds, because all the projects are on the same disk.

## The folders

```text
/
├── package.json            the site, and "workspaces": ["games/*"]
├── src/                    the front door
│   ├── content/games/      one folder for each game entry
│   └── pages/              the list page and the landing page
├── public/
│   └── games/              published builds (made by the build, not in git)
├── games/                  one folder for each game project
│   ├── td-phaser/
│   └── my-jrpg/
└── docs/                   this wiki
```

## Why the site is at the root

The arcade has one site. A folder such as `apps/site/` helps when a repo has many apps. Here it only adds one more level to each path.

## Why the games are npm workspaces

An npm workspace is a package in a sub-folder that npm installs together with the root. Each [game project](game-project.md) is a workspace. Thus:

- One `npm install` at the root installs all the games.
- The site builds one game with `npm run build -w <package name>`.
- Each game still has its own `package.json` and its own dependencies.

The repo has no folder for shared code. Each game owns its helpers. A change in one game cannot break a different game.

## An example

You start a deck builder. You make `games/deckbuilder/` with a `package.json` named `@arcade/deckbuilder`. You run `npm install` at the root. Then you make `src/content/games/hollow-hand/index.md` for its landing page, and you set `build: "@arcade/deckbuilder"`.

## Further reading

- [Front door](front-door.md): what the code in `src/` does.
- [Publishing builds](publishing-builds.md): how `public/games/` gets its files.
