// Checks the Glints and best score rules. Run: node tools/wallet-test.js
import assert from 'node:assert/strict';
import { DAILY_BONUS, WARMUP_COST, START_POWER_COST, BAN_COST } from '../src/js/prices.js';
import { canAfford, bestScore, recordBest, claimDailyBonus, dayKey, dailyFor, boostsCost } from '../src/js/wallet.js';

const save = () => ({ best: { endless: 500, timed: 300 }, daily: { date: '2026-11-07', best: 200, claimed: false } });

// The exact price can be paid, one Glint less cannot.
assert.equal(canAfford(40, 40), true);
assert.equal(canAfford(39, 40), false);

// The daily challenge keeps its own best score.
assert.equal(bestScore(save(), 'endless'), 500);
assert.equal(bestScore(save(), 'daily'), 200);

// A score above the best is saved for that mode only.
let result = recordBest(save(), 'endless', 600);
assert.equal(result.isBest, true);
assert.equal(result.best.endless, 600);
assert.equal(result.best.timed, 300);
assert.equal(result.daily.best, 200);

// A daily score above the daily best is saved in the daily record.
result = recordBest(save(), 'daily', 250);
assert.equal(result.isBest, true);
assert.equal(result.daily.best, 250);
assert.equal(result.best.endless, 500);

// A tie is not a new best, and nothing changes.
const before = save();
result = recordBest(before, 'timed', 300);
assert.equal(result.isBest, false);
assert.deepEqual(result.best, before.best);
assert.deepEqual(result.daily, before.daily);

// recordBest does not change the data it was given.
const frozen = save();
recordBest(frozen, 'endless', 9999);
assert.deepEqual(frozen, save());

// The first daily run of a day pays the bonus and marks the day as claimed.
let claim = claimDailyBonus({ date: '2026-11-07', best: 0, claimed: false });
assert.equal(claim.bonus, DAILY_BONUS);
assert.equal(claim.daily.claimed, true);

// A claimed day pays nothing more.
claim = claimDailyBonus({ date: '2026-11-07', best: 0, claimed: true });
assert.equal(claim.bonus, 0);
assert.equal(claim.daily.claimed, true);

// A day key has two digits for the month and the day.
assert.equal(dayKey(new Date(2026, 0, 5)), '2026-01-05');
assert.equal(dayKey(new Date(2026, 10, 17)), '2026-11-17');

// The daily record stays the same on the same day.
const today = { date: '2026-11-07', best: 200, claimed: true };
assert.equal(dailyFor(today, '2026-11-07'), today);

// A new day starts a fresh daily record.
assert.deepEqual(dailyFor(today, '2026-11-08'), { date: '2026-11-08', best: 0, claimed: false });

// Boosts cost the sum of the ones picked.
assert.equal(boostsCost({ warmup: false, power: null, ban: null }), 0);
assert.equal(boostsCost({ warmup: true, power: null, ban: null }), WARMUP_COST);
assert.equal(boostsCost({ warmup: true, power: 'prism', ban: 0 }), WARMUP_COST + START_POWER_COST + BAN_COST);

// Banning the first shape (number 0) is a pick, and costs.
assert.equal(boostsCost({ warmup: false, power: null, ban: 0 }), BAN_COST);

console.log('wallet ok');
