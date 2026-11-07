// Checks the list of shapes and how a shape is picked. Run: node tools/shape-list-test.js
import assert from 'node:assert/strict';
import { SHAPES, parseArt, cleanShapes, pickShape, setShapes, MAX_SHAPE_WIDTH } from '../src/js/shape-list.js';
import { SHAPE_ART } from '../src/js/shapes.js';

// ASCII art turns into cells. A hole inside a column is fine (the shape lab can make them).
assert.deepEqual(parseArt(['#', '.', '#']), [[0, 0], [0, 2]]);
assert.deepEqual(parseArt(['##', '#.']), [[0, 0], [1, 0], [0, 1]]);

// Every shape is different, has at least 2 blocks, and fits a 5-wide well.
const GRID_MIN_COLS = MAX_SHAPE_WIDTH;
assert.equal(new Set(SHAPES.map((sh) => JSON.stringify(sh))).size, SHAPES.length, 'no shape is listed twice');
for (const sh of SHAPES) {
	assert.ok(sh.length >= 2, 'a piece has at least 2 blocks');
	assert.ok(Math.max(...sh.map(([dx]) => dx)) < GRID_MIN_COLS, 'a piece is at most 5 wide');
}

// A list of good shapes passes as it is.
const good = { weight: 3, art: ['##', '#.'] };
assert.deepEqual(cleanShapes([good]), [good]);

// Bad input is dropped, not guessed.
assert.deepEqual(cleanShapes(null), [], 'a list that is not an array has no shapes');
assert.deepEqual(cleanShapes([null, 5, 'x', {}]), [], 'items that are not shapes are dropped');
assert.deepEqual(cleanShapes([{ weight: 1, art: [5] }]), [], 'art that is not text is dropped');
assert.deepEqual(cleanShapes([{ weight: 1, art: ['#'] }]), [], 'a one-block shape is dropped');
assert.deepEqual(cleanShapes([{ weight: 1, art: ['#'.repeat(MAX_SHAPE_WIDTH + 1)] }]), [], 'a shape wider than the well is dropped');

// A weight stays between 1 and 9, and a missing weight counts as 1.
assert.equal(cleanShapes([{ weight: 99, art: ['##'] }])[0].weight, 9);
assert.equal(cleanShapes([{ weight: 0, art: ['##'] }])[0].weight, 1);
assert.equal(cleanShapes([{ art: ['##'] }])[0].weight, 1);

// A list with no usable shape changes nothing.
assert.equal(setShapes([{ weight: 1, art: ['#'] }]), false);
assert.equal(SHAPES.length, SHAPE_ART.length);

// Every shape can be picked as the roll goes from 0 up to 1.
const picked = new Set();
for (let i = 0; i < 1000; i++) picked.add(pickShape(i / 1000));
assert.equal(picked.size, SHAPES.length);

// A banned shape is never picked, and every other shape still is.
const pickedWithBan = new Set();
for (let i = 0; i < 1000; i++) pickedWithBan.add(pickShape(i / 1000, 0));
assert.equal(pickedWithBan.has(0), false);
assert.equal(pickedWithBan.size, SHAPES.length - 1);

// A ban is ignored when only one shape is left in the list.
setShapes([{ weight: 1, art: ['##'] }]);
assert.equal(pickShape(0.5, 0), 0);
setShapes(SHAPE_ART);

console.log('shape list ok');
