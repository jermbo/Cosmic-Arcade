---
name: "Timed: earn time"
description: "In Timed mode, chains and big groups add seconds to a shorter clock."
tags:
  - kerplunk
persona: the player
depends-on: []
status: ready
---

[Wiki](../../../README.md) / [Kerplunk 2.0.0 stories](kerplunk-stories.md) / Timed: earn time

# Timed: earn time

As the player, I want good chains to add time in Timed mode, so that skill lets me play longer.

## Requirements

1. A Timed game starts with 60 seconds
2. A turn adds seconds for its longest chain
   - a. A chain of 3: 3 seconds
   - b. A chain of 4: 10 seconds
   - c. A chain of 5 or more: 15 seconds
3. A turn that clears a group of 6 or more blocks adds 3 seconds more
4. The seconds are constants in one place, so the owner can tune them
5. The clock shows a "+Ns" sticker when it gets time
6. The time bar does not go above 60 seconds of fill; the number shows the real time
7. Endless has no clock

## Acceptance criteria

1. GIVEN a new Timed game WHEN it starts THEN the clock shows 1:00
2. GIVEN 0:30 on the clock WHEN a turn makes a chain of 4 THEN the clock shows 0:40
   - a. AND a "+10s" sticker shows on the clock
3. GIVEN 0:30 on the clock WHEN a turn makes a chain of 3 and clears a group of 6 THEN the clock shows 0:36
4. GIVEN 0:30 on the clock WHEN a turn makes a chain of 2 THEN the clock adds no time
5. GIVEN the engine test WHEN a Timed turn with a chain of 5 goes in THEN 15 seconds come out

## Depends on

None.

## Architecture

- [Spec, scope 8](../../../initiatives/kerplunk/v2/spec.md)
- [Decision log, D6](../../../initiatives/kerplunk/v2/decision-log.md)
