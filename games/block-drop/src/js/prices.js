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
export const DAILY_BONUS = 20; // the first daily challenge run of each day
export const BAG_UPGRADE_COSTS = [150, 300]; // permanent: the bag holds 1 more power-up each time
