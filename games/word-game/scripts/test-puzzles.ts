// Bank and builder check: run with `npm test` (Node strips the types).
// Checks the bank, then builds many puzzles of each mode and checks each one is fair.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BY_LEVEL, GROUPS, GROUPS_OF_WORD, BANK_WORDS } from '../src/core/bank.ts';
import { buildCrack, buildLink, buildSecret } from '../src/core/builder.ts';
import { TUNING } from '../src/core/tuning.ts';
import { isWord, scoreGuess, setDictionary } from '../src/core/words.ts';
import type { Board } from '../src/core/types.ts';

// The bank.
const ids = new Set<string>();
for (const g of GROUPS) {
	assert(!ids.has(g.id), `group id ${g.id} twice`);
	ids.add(g.id);
	assert(g.words.length >= 5, `${g.id}: needs 5 or more words`);
	assert.equal(new Set(g.words).size, g.words.length, `${g.id}: a word twice`);
	for (const w of g.words) assert.match(w, /^[A-Z]{3,8}$/, `${g.id}: bad word ${w}`);
}
for (const level of [1, 2, 3, 4] as const) assert(BY_LEVEL[level].length >= 5, `level ${level}: needs 5 or more groups`);

// Scoring.
assert.deepEqual(scoreGuess('SPEED', 'ABIDE'), ['miss', 'miss', 'near', 'miss', 'near']);
assert.deepEqual(scoreGuess('LLAMA', 'HELLO'), ['near', 'near', 'miss', 'miss', 'miss']);
assert.deepEqual(scoreGuess('GRAPE', 'GRAPE'), ['hit', 'hit', 'hit', 'hit', 'hit']);

// The word list.
const dict = readFileSync(new URL('../src/data/dict.txt', import.meta.url), 'utf8').split('\n').filter(Boolean);
setDictionary([...dict, ...BANK_WORDS]);
for (const w of ['APPLES', 'BAKED', 'RUNNING', 'CHEERY', 'HOODIE']) assert(isWord(w), `${w} should be a word`);
assert(!isWord('QXZRT'), 'QXZRT is not a word');

function checkBoard(board: Board, maxLength = 8) {
	assert.equal(board.groups.length, 4);
	assert.deepEqual(board.groups.map((g) => g.level), [1, 2, 3, 4]);
	assert.equal(new Set(board.tiles).size, 16, 'tiles must be 16 different words');
	const onBoard = new Set(board.groups.map((g) => g.id));
	for (const g of board.groups) {
		assert.equal(g.words.length, 4);
		for (const w of g.words) {
			assert(w.length <= maxLength, `${w} too long`);
			for (const other of GROUPS_OF_WORD.get(w) ?? []) assert(other === g.id || !onBoard.has(other), `${w} fits ${g.id} and ${other}`);
		}
	}
}

const RUNS = 400;
const seen = new Set<string>();
for (let i = 0; i < RUNS; i++) {
	const crack = buildCrack(`t-crack-${i}`);
	checkBoard(crack.board);
	crack.locked.forEach((w, k) => assert(crack.board.groups[k].words.includes(w), 'locked word not in its group'));
	seen.add(crack.board.groups.map((g) => g.id).join(','));

	const secret = buildSecret(`t-secret-${i}`);
	checkBoard(secret.board);
	assert(secret.word.length >= TUNING.secret.minLength && secret.word.length <= TUNING.secret.maxLength);
	assert(!secret.board.tiles.includes(secret.word), 'secret word is on the board');
	assert.equal(new Set(secret.reveal).size, 4);

	const link = buildLink(`t-link-${i}`);
	assert.equal(link.rounds.length, 4);
	for (const r of link.rounds) {
		assert.equal(r.options.length, TUNING.link.options);
		assert(r.options.includes(r.group.theme));
		assert.equal(new Set(r.options).size, r.options.length, 'two options are the same');
		for (const w of r.group.words) assert(w.length <= TUNING.link.maxLength);
	}
}

// Same seed, same puzzle.
assert.deepEqual(buildCrack('same'), buildCrack('same'));

console.log(`OK: ${GROUPS.length} groups, ${RUNS * 3} puzzles, ${seen.size} different crack boards.`);
