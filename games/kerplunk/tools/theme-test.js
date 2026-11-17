// Checks the theme values and the Random roll. Run: node tools/theme-test.js
import assert from 'node:assert/strict';
import { LIGHT, DARK, rollTheme, textOn, isTheme, RANDOM_BACKGROUNDS, RANDOM_CARDS, RANDOM_WELLS, RANDOM_BLOCK_SETS, RANDOM_DISPLAYS, INK } from '../src/js/themes.js';
import { makeRng } from '../src/js/engine.js';

// The Light theme.
assert.equal(LIGHT.bg, '#FFF8E7');
assert.equal(LIGHT.accent, '#FFD93D');
assert.deepEqual(LIGHT.blocks, ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#C084FC']);
assert.deepEqual([LIGHT.bw, LIGHT.sh, LIGHT.r], [3, 4, 6]);

// The Dark theme keeps the block colors and has off-white ink.
assert.equal(DARK.bg, '#121212');
assert.equal(DARK.ink, '#F4F1EA');
assert.equal(DARK.onAccent, '#111111', 'the score card text is black');
assert.deepEqual(DARK.blocks, LIGHT.blocks);

// Text on a card is black or white, whichever has more contrast.
assert.equal(textOn('#111111'), '#FFFFFF');
assert.equal(textOn('#FFD93D'), '#111111');

// 1000 rolls: every value comes from its list, and no card has the color of the background.
const rng = makeRng(7);
const seen = { bg: new Set(), display: new Set() };
for (let i = 0; i < 1000; i++) {
	const t = rollTheme(rng);
	assert.ok(isTheme(t), 'a roll is a full theme');
	assert.ok(RANDOM_BACKGROUNDS.includes(t.bg));
	assert.ok(RANDOM_CARDS.includes(t.accent) && RANDOM_CARDS.includes(t.accent2));
	assert.notEqual(t.accent, t.bg, 'the score card is never the background color');
	assert.notEqual(t.accent2, t.bg, 'the Plunks card is never the background color');
	assert.notEqual(t.accent, t.accent2, 'the two cards differ');
	assert.ok(RANDOM_WELLS.includes(t.well));
	assert.ok(RANDOM_BLOCK_SETS.some((set) => set.join() === t.blocks.join()));
	assert.ok(RANDOM_DISPLAYS.includes(t.display));
	assert.ok([3, 4].includes(t.bw) && [4, 5, 6].includes(t.sh) && [0, 6, 12].includes(t.r));
	assert.ok(t.tilt >= -2.5 && t.tilt <= 2.5);
	assert.equal(t.ink, INK, 'the ink is always #111111');
	if (t.accent === '#111111') assert.equal(t.onAccent, '#FFFFFF', 'a black score card has a white score');
	seen.bg.add(t.bg);
	seen.display.add(t.display);
}
assert.equal(seen.bg.size, RANDOM_BACKGROUNDS.length, 'every background shows up');
assert.equal(seen.display.size, 2);

// Two rolls can differ.
assert.notDeepEqual(rollTheme(makeRng(1)), rollTheme(makeRng(2)));

console.log('theme ok');
