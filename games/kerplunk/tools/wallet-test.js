// Checks the Plunks and best score rules. Run: node tools/wallet-test.js
import assert from 'node:assert/strict';
import { THEMES, STYLES } from '../src/js/shop/shop-items.js';
import { WARMUP_COST, START_POWER_COST, BAN_COST } from '../src/js/shop/prices.js';
import { canAfford, bestScore, recordBest, boostsCost, buyLook } from '../src/js/shop/wallet.js';

const save = () => ({ best: { endless: 500, timed: 300 } });

// The exact price can be paid, one Plunk less cannot.
assert.equal(canAfford(40, 40), true);
assert.equal(canAfford(39, 40), false);

// Each mode keeps its own best score.
assert.equal(bestScore(save(), 'endless'), 500);
assert.equal(bestScore(save(), 'timed'), 300);

// A score above the best is saved for that mode only.
let result = recordBest(save(), 'endless', 600);
assert.equal(result.isBest, true);
assert.equal(result.best.endless, 600);
assert.equal(result.best.timed, 300);

// A tie is not a new best, and nothing changes.
const before = save();
result = recordBest(before, 'timed', 300);
assert.equal(result.isBest, false);
assert.deepEqual(result.best, before.best);

// recordBest does not change the data it was given.
const frozen = save();
recordBest(frozen, 'endless', 9999);
assert.deepEqual(frozen, save());

// Boosts cost the sum of the ones picked.
assert.equal(boostsCost({ warmup: false, power: null, ban: null }), 0);
assert.equal(boostsCost({ warmup: true, power: null, ban: null }), WARMUP_COST);
assert.equal(boostsCost({ warmup: true, power: 'prism', ban: 0 }), WARMUP_COST + START_POWER_COST + BAN_COST);

// Banning the first shape (number 0) is a pick, and costs.
assert.equal(boostsCost({ warmup: false, power: null, ban: 0 }), BAN_COST);

// Buying a look takes its price and owns it.
const look = (list, id) => list.find((item) => item.id === id);
const tide = look(THEMES, 'tide');
assert.deepEqual(buyLook(342, ['oat'], tide), { glints: 342 - tide.price, owned: ['oat', 'tide'] });

// With too few Plunks, or an item that is owned, nothing changes.
const owned = ['oat'];
assert.equal(buyLook(100, owned, look(THEMES, 'tide')), null);
assert.deepEqual(owned, ['oat'], 'the owned list does not change');
assert.equal(buyLook(999, ['oat', 'tide'], look(THEMES, 'tide')), null, 'an owned item is not bought again');

// Oat, Plum and Patterns are free.
assert.equal(look(THEMES, 'oat').price, 0);
assert.equal(look(THEMES, 'plum').price, 0);
assert.equal(look(STYLES, 'patterns').price, 0);

console.log('wallet ok');
