// What things cost in Glints, and what a purchase gives. The shop and the game over screen read these.

export const WARMUP_COST = 25; // the game plays WARMUP_ROUNDS rounds for you at the start
export const SECOND_WIND_COST = 40;
// Boosts bought at the start of a game, and things bought during or after a game.
export const START_POWER_COST = 20; // begin with one power-up of your choice
export const BAN_COST = 30; // keep one shape out of this game
export const REROLL_COST = 10; // swap the tray for new pieces; each use in a game costs REROLL_STEP more
export const REROLL_STEP = 5;
export const EXTEND_COST = 20; // +EXTEND_SECONDS in Timed, once per game
export const EXTEND_SECONDS = 15;
export const BAG_UPGRADE_COSTS = [150, 300]; // permanent: the bag holds 1 more power-up each time
// The looks, bought once in the shop. Drafts: the owner tunes them.
export const THEME_PRICES = { sage: 150, blossom: 150, sky: 150, tide: 200, hearth: 200, random: 300 };
export const STYLE_PRICES = { patterns: 0, symbols: 100, pips: 100, silhouettes: 150, faces: 250 };
// The feel, bought once in the shop: sound profiles and animation styles. Drafts too.
export const SOUND_PRICES = { wooden: 0, bubbles: 100, thumbPiano: 100, woodshop: 100, musicBox: 150, glass: 150, island: 150, cozyKeys: 150, zen: 150, cartoon: 200, arcade: 200, space: 250 };
export const MOTION_PRICES = { classic: 0, snappy: 100, bouncy: 150, heavy: 150, floaty: 150 };
