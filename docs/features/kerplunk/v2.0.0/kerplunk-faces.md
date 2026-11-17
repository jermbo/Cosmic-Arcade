---
name: Buy and use Faces
description: "The player can buy the Faces block style: each color has a mood, and the faces blink."
tags:
  - kerplunk
persona: the player
depends-on:
  - kerplunk-block-styles.md
status: ready
---

[Wiki](../../../README.md) / [Kerplunk 2.0.0 stories](kerplunk-stories.md) / Buy and use Faces

# Buy and use Faces

As the player, I want blocks with faces that blink, so that the well feels alive.

## Requirements

1. Faces is in the Block styles section for ✦250
2. Each color has a face in black or white, whichever has more contrast on the block
   - a. Ember: grumpy (slanted brows, flat mouth)
   - b. Amber: happy (round eyes, smile)
   - c. Moss: sleepy (closed eyes, small round mouth)
   - d. Tide: surprised (big eyes, round open mouth)
   - e. Dusk: wink (one eye open, one closed, half smile)
3. Each face blinks once every 6 seconds, each at its own moment
4. A face that clears gets bigger for a moment as it falls
5. Faces do not react to the state of the game

## Acceptance criteria

1. GIVEN 342 Glints WHEN the player buys Faces THEN the wallet shows 92 Glints
2. GIVEN Faces is in use WHEN the player looks at a Moss block THEN its eyes are closed
3. GIVEN Faces is in use WHEN the player watches the well for 6 seconds THEN each open eye blinks once, not all at the same time
4. GIVEN the grayscale filter of the phone is on WHEN Faces is in use THEN the five colors look different

## Depends on

- [Buy and use Symbols, Dice pips and Silhouettes](kerplunk-block-styles.md): it makes the Block styles section.

## Architecture

- [Spec, scope 5 b to 5 d](../../../initiatives/kerplunk/v2/spec.md)
