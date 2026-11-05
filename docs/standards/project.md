---
title: Project facts
summary: "The facts of this project that the workflow skills read: the pages, the commands, and the test data for stories."
updated: 2026-11-05
---

# Project facts

The workflow skills hold the method and the baseline rules. This page holds the facts of this project, and the files of the rules that differ. Each skill reads it before its first step.

## The product

| Fact            | Value                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Name            | Cosmic Arcade                                                                                                                  |
| What it is      | A personal arcade: an Astro site that registers games and tabletop RPGs as content, where each game is built in the engine that fits it. |
| The word for it | "the arcade". One thing in it is "a game", tabletop RPGs included.                                                             |
| Content format  | Plain Markdown (`.md`). No MDX.                                                                                                |

## Pages

| Page                  | Path                       |
| --------------------- | -------------------------- |
| Wiki home             | `docs/README.md`           |
| Vision                | `docs/vision.md`           |
| Glossary              | `docs/glossary.md`         |
| Personas              | `docs/personas.md`         |
| Initiatives           | `docs/initiatives/<slug>/` |
| Stories               | `docs/features/<version>/` |
| What the product does | `docs/features/README.md`  |
| Architecture          | `docs/architecture/`       |

## Rules that differ

The `docs-wiki` and `code-standards` skills have the baseline rules. A file here holds only the rules that are different in this project. For each subject that it names, it wins over the baseline. "None" means the baseline alone.

| Rules      | Path |
| ---------- | ---- |
| Page rules | None |
| Code rules | None |

## Forms

A form here replaces the form of the skill. "Skill" uses the form of the skill.

| Form         | Path  |
| ------------ | ----- |
| Decision log | Skill |
| Spec         | Skill |
| User story   | Skill |
| Pull request | Skill |

## Models

A model is a page that shows a form with real content.

| Model      | Path |
| ---------- | ---- |
| Initiative | None |
| Story      | None |
| Story list | None |

## Commands

| Command | Value                                                                     |
| ------- | ------------------------------------------------------------------------- |
| Check   | `npm run check` (`astro check`)                                           |
| Test    | None. The arcade and each game own their own tests, if they ever get any. |
| Dev     | `npm run dev` (port 3333)                                                 |

## Sides of the code

| Side     | Folders |
| -------- | ------- |
| Frontend | `src/`  |
| Backend  | None    |

## Layers

| Layer     | Folders or files |
| --------- | ---------------- |
| Shell     | `src/pages/`     |
| Interface | None             |
| State     | None             |
| Domain    | None             |

## Versions

| Fact           | Value                                                            |
| -------------- | ---------------------------------------------------------------- |
| Branch form    | `feature/v<version>`                                             |
| Version folder | The version in the branch name: `feature/v0.2.0` gives `v0.2.0`. |

## Test data

| Fact      | Value                                                                                                                                                                  |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test data | Two minimal stubs, each titled with the prefix `STUB:`. `STUB: Game` has a build (`@arcade/stub-game`). `STUB: Tabletop` has no build. They hold only the required fields. |

## The persona test

One line for each limit of a persona that a design must pass, as a question.

- The phone visitor reads a game page on a 375px screen. Does the page read well, even when the game itself is desktop only?
- The player is inside a game. Can they get back to the arcade without the back button of the browser?
- The player wants to know if a game works on their device. Does the game page state its platforms and inputs?

## Merge danger

| Fact         | Value                                                                                                                        |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| One-way door | Published URLs: `/games/<slug>/` and `/games/<slug>/play/`. The form of saved game data is not decided yet.                  |
| Blast radius | Each entry of the games collection when its schema changes, narrow screens, and per-game host headers (COOP/COEP for Godot). |

## Design and UI

| Fact          | Value |
| ------------- | ----- |
| Design tokens | None  |
| Design rules  | None  |
| Shared parts  | None  |

## UI prototypes

| Fact           | Value                                                         |
| -------------- | ------------------------------------------------------------- |
| Variant folder | Where a variant goes: a folder `prototype/` next to the part. |
| Dev-only flag  | `import.meta.env.DEV`                                         |
