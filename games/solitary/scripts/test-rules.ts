// Rules check: run with `npm test` (Node strips the types).
// A bot plays many deals by following the hints. Every step checks that no card is lost.
import assert from 'node:assert/strict';
import type { DealOptions, ModeId, State } from '../src/core/types.ts';
import { makeRules, type Rules } from '../src/rules/index.ts';

function checkCards(rules: Rules, state: State) {
	const seen = new Set<number>();
	for (const pile of rules.pileIds) for (const c of state.piles[pile]) {
		assert(!seen.has(c.id), `card ${c.id} twice`);
		seen.add(c.id);
	}
	assert.equal(seen.size, rules.deck.length, 'a card went missing');
}

const key = (s: State) => Object.values(s.piles).map((p) => p.map((c) => c.id + (c.up ? 'u' : 'd')).join(',')).join('|');

function settle(rules: Rules, state: State): State {
	for (let m = rules.autoMove(state); m; m = rules.autoMove(state)) state = rules.apply(state, m, false);
	if (rules.canFinish(state)) for (let m = rules.finishMove(state); m; m = rules.finishMove(state)) state = rules.apply(state, m, false);
	return state;
}

function play(mode: ModeId, opts: DealOptions, seed: number): { won: boolean; steps: number } {
	const rules = makeRules(mode, opts, seed);
	let state = settle(rules, rules.initial());
	const visited = new Set([key(state)]);
	for (let step = 0; step < 3000; step++) {
		checkCards(rules, state);
		if (rules.isWon(state)) return { won: true, steps: step };
		let moved = false;
		for (const hint of rules.hints(state)) {
			let next: State | null = null;
			if (hint.kind === 'move') {
				assert(rules.canMove(state, hint.move), 'hint gave an illegal move');
				next = rules.apply(state, hint.move);
			} else {
				const r = rules.stock(state);
				if (r && typeof r !== 'string') next = r.state;
			}
			if (!next) continue;
			next = settle(rules, next);
			const k = key(next);
			if (visited.has(k)) continue;
			visited.add(k);
			state = next;
			moved = true;
			break;
		}
		if (!moved) return { won: false, steps: step };
	}
	return { won: false, steps: 3000 };
}

// FreeCell deal 1 must match the classic numbered deal.
{
	const rules = makeRules('freecell', { draw: 1, suits: 1 }, 1);
	const s = rules.initial();
	const firstRow = ['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7'].map((t) => rules.short(s.piles[t][0].id));
	assert.deepEqual(firstRow, ['J♦', '2♦', '9♥', 'J♣', '5♦', '7♥', '7♣', '5♥']);
	console.log('FreeCell deal 1 matches.');
}

// Illegal moves are refused.
{
	const rules = makeRules('klondike', { draw: 1, suits: 1 }, 7);
	const s = rules.initial();
	assert(!rules.canPick(s, 't6', 0), 'picked a face-down card');
	assert(!rules.canPick(s, 'stock', 0), 'picked from stock');
	const spider = makeRules('spider', { draw: 1, suits: 4 }, 3);
	const sp = spider.initial();
	sp.piles.t0 = [];
	assert.equal(typeof spider.stock(sp), 'string', 'dealt onto an empty column');
	console.log('Illegal moves refused.');
}

const variants: [ModeId, DealOptions][] = [
	['klondike', { draw: 1, suits: 1 }],
	['klondike', { draw: 3, suits: 1 }],
	['spider', { draw: 1, suits: 1 }],
	['spider', { draw: 1, suits: 2 }],
	['spider', { draw: 1, suits: 4 }],
	['freecell', { draw: 1, suits: 1 }],
];
const games = Number(process.argv[2] ?? 60);
for (const [mode, opts] of variants) {
	let wins = 0;
	const winSeeds: number[] = [];
	for (let seed = 1; seed <= games; seed++) {
		const r = play(mode, opts, seed);
		if (r.won) {
			wins++;
			if (winSeeds.length < 5) winSeeds.push(seed);
		}
	}
	console.log(`${mode} ${JSON.stringify(opts)}: hint bot won ${wins}/${games}. Seeds: ${winSeeds.join(', ')}`);
}
