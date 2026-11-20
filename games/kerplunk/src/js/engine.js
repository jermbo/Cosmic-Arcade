// A door for the tests in tools/ and tools/sim.js: they import the rules from this path.
// The rules live in rules/. Start reading at rules/game.js.
export { Game } from './rules/game.js';
export { GRID_SIZES, DEFAULT_LAB, MAX_COLORS, colorsForTurn } from './rules/game-settings.js';
export { makeRng, dailySeed } from './rules/random.js';
export { groupMultiplier, glintsFor, glintsForAllClear, GLINT_ALL_CLEAR } from './rules/scoring.js';
export { TIMED_SECONDS, TIME_FOR_CHAIN, TIME_FOR_BIG_GROUP, BIG_GROUP, LOW_TIME_SECONDS, LOUD_TICK_SECONDS, timeForTurn } from './rules/timed-mode.js';
export { POWER_KINDS, REWARD_CHAIN, REWARD_GROUP, BAG_SIZE } from './rules/power-ups.js';
export { SECOND_WIND_ROWS } from './rules/second-wind.js';
