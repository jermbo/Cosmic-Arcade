// Bank and builder check: run with `npm test` (Node strips the types).
// Checks the bank, then builds many puzzles of each mode and checks each one is fair.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BY_LEVEL, GROUPS, GROUPS_OF_WORD, BANK_WORDS } from '../src/core/bank.ts';
import { buildCrack, buildLink, buildSecret } from '../src/core/builder.ts';
import { DIFFICULTIES, DIFFICULTY, TUNING } from '../src/core/tuning.ts';
import { isWord, scoreGuess, setDictionary } from '../src/core/words.ts';
import type { Board } from '../src/core/types.ts';
import { buildChain, CHAIN_MODES } from '../src/core/chain.ts';
import setsData from '../src/data/sets.json' with { type: 'json' };
import { MOTION_FEEL, MOTIONS, SECTIONS } from '../src/shop/catalog.ts';
import { RUN } from '../src/core/economy.ts';

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
	assert.deepEqual(board.groups.map((g) => g.level), [1, 2, 3, 4], 'board colors go 1 to 4');
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

const RUNS = 300;
const seen = new Set<string>();
for (const diff of DIFFICULTIES) {
	const D = DIFFICULTY[diff];
	for (let i = 0; i < RUNS; i++) {
		const crack = buildCrack(`t-crack-${i}`, diff);
		checkBoard(crack.board);
		crack.locked.forEach((w, k) => {
			assert(crack.board.groups[k].words.includes(w), 'locked word not in its group');
			assert(w.length >= D.crack.minLength && w.length <= D.crack.maxLength, `${diff}: locked ${w} has the wrong length`);
			const shown = crack.hints[k].filter(Boolean).length;
			assert.equal(shown, D.crack.showFirst ? 1 + D.crack.showExtra : 0, `${diff}: wrong number of given letters`);
		});
		seen.add(diff + crack.board.groups.map((g) => g.id).join(','));

		const secret = buildSecret(`t-secret-${i}`, diff);
		checkBoard(secret.board);
		assert(secret.word.length >= D.secret.minLength && secret.word.length <= D.secret.maxLength);
		assert(!secret.board.tiles.includes(secret.word), 'secret word is on the board');
		assert.equal(new Set(secret.reveal).size, 4);

		const link = buildLink(`t-link-${i}`, diff);
		assert.equal(link.rounds.length, 4);
		for (const r of link.rounds) {
			assert.equal(r.options.length, D.link.options);
			assert(r.options.includes(r.group.theme));
			assert.equal(new Set(r.options).size, r.options.length, 'two options are the same');
			for (const w of r.group.words) assert(w.length <= TUNING.link.maxLength);
		}
	}
}

// Kin Book sets: every bank group is in exactly one set.
const inSet = new Map<string, string>();
for (const s of setsData) for (const g of s.groups) {
	assert(ids.has(g), `set ${s.id}: no group ${g}`);
	assert(!inSet.has(g), `group ${g} is in ${inSet.get(g)} and ${s.id}`);
	inSet.set(g, s.id);
}
for (const id of ids) assert(inSet.has(id), `group ${id} is in no Kin Book set`);

// Daily chain: a 6 letter word, 2 different spots per mode.
for (const diff of DIFFICULTIES) {
	for (let d = 1; d <= 28; d++) {
		const date = `2026-12-${String(d).padStart(2, '0')}`;
		const chain = buildChain(diff, date);
		assert.equal(chain.word.length, TUNING.chain.length);
		const spots = CHAIN_MODES.flatMap((m) => chain.spots[m]);
		assert.equal(new Set(spots).size, TUNING.chain.length, 'chain spots must cover each letter once');
		assert.notEqual(chain.word, buildSecret(`secret|${diff}|${date}`, diff, date).word, 'chain word equals the secret word');
		assert.deepEqual(buildChain(diff, date), chain, 'chain must be the same each time');
	}
}

// Shop: each section starts with a free item, ids are unique, prices are whole numbers.
for (const s of SECTIONS) {
	assert.equal(s.items[0].price, 0, `${s.id}: the first item must be free`);
	assert.equal(new Set(s.items.map((i) => i.id)).size, s.items.length, `${s.id}: an id twice`);
	for (const i of s.items) assert(Number.isInteger(i.price) && i.price >= 0, `${s.id}/${i.id}: bad price`);
}
for (const m of MOTIONS) assert(MOTION_FEEL[m.id], `motion ${m.id} has no feel`);
assert(RUN.tiers.length > 0 && RUN.rotation.length > 0 && RUN.hearts <= RUN.maxHearts, 'RUN settings look wrong');

// Same seed, same puzzle.
assert.deepEqual(buildCrack('same', 'medium'), buildCrack('same', 'medium'));

console.log(`OK: ${GROUPS.length} groups, ${RUNS * 9} puzzles over 3 difficulties, ${seen.size} different crack boards.`);
