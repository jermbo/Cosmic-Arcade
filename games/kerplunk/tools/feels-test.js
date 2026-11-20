// Checks the sound profiles and animation styles of the shop. Run: node tools/feels-test.js
import assert from 'node:assert/strict';
import { SOUND_PROFILES, PROFILE_KEYS } from '../src/js/feel/sound-profiles.js';
import { MOTION_STYLES } from '../src/js/feel/motion-styles.js';
import { applyFeel, withSound, soundValues } from '../src/js/feel/player-feel.js';
import { tuning } from '../src/js/feel/tuning.js';
import { DEFAULT_TUNING } from '../src/js/feel/default-tuning.js';
import { SCALES, CLEAR_STYLES, CHAIN_STYLES, POWER_STYLES, SMALL_STYLES } from '../src/js/feel/sound-styles.js';
import { BODIES } from '../src/js/audio/instrument-bodies.js';

const ids = (list) => list.map((item) => item.id);

for (const list of [SOUND_PROFILES, MOTION_STYLES]) {
	// Each item has its own id, a price, a name and a text, and the first one is free.
	assert.equal(new Set(ids(list)).size, list.length);
	assert.equal(list[0].price, 0);
	for (const item of list) {
		assert.equal(typeof item.price, 'number', `${item.id} has no price`);
		assert.ok(item.name && item.text, `${item.id} needs a name and a text`);
	}
}

// A profile only names bodies, styles and scales that exist.
const known = { body: BODIES, clearStyle: CLEAR_STYLES, scale: SCALES, chainStyle: CHAIN_STYLES, powerStyle: POWER_STYLES, smallStyle: SMALL_STYLES };
for (const profile of SOUND_PROFILES) {
	for (const [key, value] of Object.entries(profile.values)) {
		assert.ok(PROFILE_KEYS.includes(key), `${profile.id}: ${key} is not a profile key`);
		assert.ok(known[key][value], `${profile.id}: ${key} "${value}" does not exist`);
	}
}

// A style only sets motion numbers that exist.
for (const style of MOTION_STYLES) {
	for (const [key, value] of Object.entries(style.values)) {
		assert.equal(typeof DEFAULT_TUNING.motion[key], typeof value, `${style.id}: ${key}`);
	}
}

// Using a profile sets its values; going back to the free one puts the loaded tuning back.
applyFeel('cartoon', 'floaty');
assert.equal(tuning.sound.body, 'boing');
assert.equal(tuning.motion.gravity, 28);
applyFeel('wooden', 'classic');
assert.equal(tuning.sound.body, DEFAULT_TUNING.sound.body);
assert.equal(tuning.motion.gravity, DEFAULT_TUNING.motion.gravity);

// Picks do not stack: a style that leaves a number alone gets the loaded value, not the last style's.
applyFeel('wooden', 'heavy');
applyFeel('wooden', 'bouncy');
assert.equal(tuning.motion.landShake, DEFAULT_TUNING.motion.landShake);

// withSound plays with a profile and then puts the one in use back.
applyFeel('glass', 'classic');
const heard = withSound('space', () => tuning.sound.body);
assert.equal(heard, 'laser');
assert.equal(tuning.sound.body, 'glassBell');
assert.deepEqual(soundValues('wooden').body, DEFAULT_TUNING.sound.body);
applyFeel('wooden', 'classic');

console.log('feels ok');
