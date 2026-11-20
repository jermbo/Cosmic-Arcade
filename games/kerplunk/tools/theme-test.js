// Checks the theme values and the Random roll. Run: node tools/theme-test.js
import assert from 'node:assert/strict';
import { LIGHT, DARK, rollTheme, textOn, isTheme, INK } from '../src/js/looks/themes.js';
import { makeRng } from '../src/js/rules/random.js';

// The Dark theme keeps the block colors, so a color means the same thing in both.
assert.deepEqual(DARK.blocks, LIGHT.blocks);

// Text on a card is black or white, whichever has more contrast.
assert.equal(textOn('#111111'), '#FFFFFF');
assert.equal(textOn('#FFD93D'), '#111111');

// 1000 rolls: a roll is a full theme, no card has the color of the background, and text stays readable.
const rng = makeRng(7);
for (let i = 0; i < 1000; i++) {
	const t = rollTheme(rng);
	assert.ok(isTheme(t), 'a roll is a full theme');
	assert.notEqual(t.accent, t.bg, 'the score card is never the background color');
	assert.notEqual(t.accent2, t.bg, 'the Plunks card is never the background color');
	assert.notEqual(t.accent, t.accent2, 'the two cards differ');
	assert.equal(t.ink, INK, 'the ink is always the same black');
	assert.equal(t.onAccent, textOn(t.accent), 'the score is black or white, whichever reads better');
}

// A roll after another one never has the same background.
let last = rollTheme(rng);
for (let i = 0; i < 200; i++) {
	const next = rollTheme(rng, last);
	assert.notEqual(next.bg, last.bg, 'each new roll has another background');
	last = next;
}

console.log('theme ok');
