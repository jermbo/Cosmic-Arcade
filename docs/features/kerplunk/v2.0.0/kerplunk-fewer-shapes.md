---
name: Fewer, more fun shapes
description: "The shape list drops to 14 shapes, with four fun shapes at a low weight."
tags:
  - kerplunk
persona: the player
depends-on: []
status: ready
---

[Wiki](../../../README.md) / [Kerplunk 2.0.0 stories](kerplunk-stories.md) / Fewer, more fun shapes

# Fewer, more fun shapes

As the player, I want fewer and more distinct shapes, with a few fun ones, so that I must plan where each piece goes.

## Requirements

1. The built-in shape list has these 14 shapes and weights (rows split by `/`)
   - a. Weight 3: `###`, `#/#/#`, `##/#.`, `##/.#`, `#./##`, `.#/##`
   - b. Weight 3: `##/##`, `###/.#.`, `.##/##.`, `##./.##`
   - c. Weight 1: `#.#/###` (U), `###/#.#` (upside-down U), `.#./###/.#.` (plus), `#../##./.##` (stair)
2. No shape has fewer than 3 blocks
3. The shape lab shows the new list when no custom list is saved
4. "Ban a shape" lists the 14 shapes
5. The owner may change the list and the weights after a sim run; the story records the final list in the game README

## Acceptance criteria

1. GIVEN no custom shape list WHEN the player plays 200 turns THEN each piece is one of the 14 shapes
   - a. AND no piece has 2 blocks
2. GIVEN no custom shape list WHEN the player opens the shape lab THEN it shows 14 shapes
3. GIVEN the "Ban a shape" boost WHEN the player opens it THEN it lists 14 shapes
4. GIVEN the shape list test WHEN it runs THEN each shape has 3 or more blocks and fits the narrowest well
5. GIVEN the sim WHEN it runs before and after the change THEN the owner sees the average score and game length of each

## Depends on

None.

## Architecture

- [Spec, scope 1](../../../initiatives/kerplunk/v2/spec.md)
- [Game README, Shapes](../../../../games/kerplunk/README.md)
