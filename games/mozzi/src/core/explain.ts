/**
 * Turns a logic step into plain words: what blocks every other choice, and which
 * tiles to light up while saying it.
 */
import { CELLS, bits, colOf, lineName, rowOf } from './grid.ts';
import type { Candidates, Fact, Reason, Step, Tier, Technique } from './logic.ts';
import { axisPairs, known } from './logic.ts';
import type { Axis } from './types.ts';
import type { Sentence, Token } from './words.ts';

/** One reason, with the tiles it points at. */
export interface Because {
	says: Sentence;
	/** Tiles that cause the block (lit as "blockers"). */
	cells: number[];
	/** The tile that is ruled out, when the reason is about another tile. */
	about?: number;
}

export interface Explanation {
	tier: Tier;
	technique: Technique;
	target: number;
	facts: Fact[];
	/** Level 1: where to look. */
	where: Sentence;
	/** Tiles to outline at level 1 (the line or area being checked). */
	focus: number[];
	/** Level 2: the question, then one reason per ruled-out choice, then the answer. */
	question: Sentence;
	reasons: Because[];
	answer: Sentence;
}

const val = (axis: Axis, v: number): Token => (axis === 'num' ? { t: 'num', v } : { t: 'color', v });
const cell = (c: number): Token => ({ t: 'cell', cell: c });
const other = (axis: Axis): Axis => (axis === 'num' ? 'color' : 'num');

/** "row 2" or "column B": the line that tiles a and b share. */
function sharedLine(a: number, b: number): string {
	return rowOf(a) === rowOf(b) ? `row ${rowOf(a) + 1}` : `column ${'ABCD'[colOf(a)]}`;
}

function tradeReason(cand: Candidates, r: Extract<Reason, { kind: 'trade' }>, depth: number): Because {
	const [mine, partner] = r.known;
	const row = r.lineKind === 'row';
	const myLine = row ? `row ${rowOf(mine) + 1}` : `column ${'ABCD'[colOf(mine)]}`;
	const theirLine = row ? `row ${rowOf(partner) + 1}` : `column ${'ABCD'[colOf(partner)]}`;
	const says: Sentence = [
		row ? 'rows ' : 'columns ',
		row ? `${rowOf(mine) + 1} and ${rowOf(partner) + 1}` : `${'ABCD'[colOf(mine)]} and ${'ABCD'[colOf(partner)]}`,
		' trade in pairs. ',
		cell(mine),
		' is ',
		val(r.axis, r.b),
		' and ',
		cell(partner),
		' is ',
		val(r.axis, r.a),
		', so wherever ',
		myLine,
		' has ',
		val(r.axis, r.a),
		', ',
		theirLine,
		' has ',
		val(r.axis, r.b),
		'. ',
		cell(r.mirror),
		' can’t be ',
		val(r.axis, r.b),
	];
	const cells = [mine, partner, r.mirror];
	// Say why the mirror tile can't be b, one level deep.
	const inner = depth === 0 ? blockOf(cand, r.mirror, r.axis, r.b, 1) : null;
	if (inner) {
		says.push(' (', ...inner.says, ')');
		cells.push(...inner.cells);
	}
	return { says, cells };
}

/**
 * Why value v (a number or a color) can't go in this open tile.
 * Returns null if it can (that would be a bug in the caller).
 *
 * Every pair with v was ruled out, and there are only three ways that happens:
 * 1. a tile in the same line already has v,
 * 2. a trade rules v out,
 * 3. for each color (or number) the tile can still be, that pair with v is used.
 */
export function blockOf(cand: Candidates, c: number, axis: Axis, v: number, depth = 0): Because | null {
	const pairs = bits(axisPairs(axis, v));
	if (pairs.some((p) => cand.pairs[c] & (1 << p))) return null;
	const k = known(cand.board, axis);
	if (k[c] >= 0) return { says: [depth ? 'it is ' : 'it is already ', val(axis, k[c])], cells: [] };
	for (let peer = 0; peer < CELLS; peer++) {
		if (peer !== c && k[peer] === v && (rowOf(peer) === rowOf(c) || colOf(peer) === colOf(c)))
			return { says: [sharedLine(c, peer), ' already has ', val(axis, v), ' at ', cell(peer)], cells: [peer] };
	}
	for (const p of pairs) {
		const r = cand.why[c * 16 + p];
		if (r && r.kind === 'trade' && r.axis === axis) return tradeReason(cand, r, depth);
	}
	const o = other(axis);
	const ownOther = known(cand.board, o)[c];
	const can = bits(cand.options(c, o)); // what the tile can still be on the other side
	const used: { w: number; by: number }[] = [];
	for (const w of can) {
		const pair = axis === 'num' ? v * 4 + w : w * 4 + v;
		const r = cand.why[c * 16 + pair];
		if (r && r.kind === 'pairUsed') used.push({ w, by: r.by });
	}
	const pairTok = (w: number): Token => (axis === 'num' ? { t: 'pair', n: v, c: w } : { t: 'pair', n: w, c: v });
	if (used.length === can.length && used.length > 0) {
		const lead: Sentence = ownOther >= 0 ? ['it is ', val(o, ownOther), ', and '] : ['it can only be ', ...joinOr(can.map((w) => val(o, w))), ', and '];
		const list: Sentence = [];
		used.forEach((u, i) => list.push(...(i ? [i === used.length - 1 ? ' and ' : ', '] : []), 'the ', pairTok(u.w), ' (at ', cell(u.by), ')'));
		return { says: [...lead, ...list, used.length > 1 ? ' are used' : ' is used'], cells: used.map((u) => u.by) };
	}
	// Not expected: the tests count how often this shows up.
	return { says: ['nothing it can still be goes with ', val(axis, v)], cells: [] };
}

function joinOr(items: Token[]): Sentence {
	const out: Sentence = [];
	items.forEach((t, i) => out.push(...(i ? [i === items.length - 1 ? ' or ' : ', '] : []), t));
	return out;
}

/** Why a pair can't go in a tile. */
function pairBlock(cand: Candidates, c: number, n: number, k: number): Because {
	const numBlock = known(cand.board, 'num')[c] >= 0 ? null : blockOf(cand, c, 'num', n);
	if (known(cand.board, 'num')[c] >= 0 && known(cand.board, 'num')[c] !== n)
		return { says: ['it is ', val('num', known(cand.board, 'num')[c])], cells: [] };
	if (known(cand.board, 'color')[c] >= 0 && known(cand.board, 'color')[c] !== k)
		return { says: ['it is ', val('color', known(cand.board, 'color')[c])], cells: [] };
	if (numBlock) return numBlock;
	const colorBlock = known(cand.board, 'color')[c] >= 0 ? null : blockOf(cand, c, 'color', k);
	if (colorBlock) return colorBlock;
	// Not expected: the pair is unfinished, so only number or color blocks can rule it out.
	return { says: ['it can’t hold it'], cells: [] };
}

export function explain(step: Step): Explanation {
	const { cand, cell: target, axis, value } = step;
	const base = { tier: step.tier, technique: step.technique, target, facts: step.facts };

	if (step.technique === 'onlySpot') {
		const line = step.line!;
		const name = lineName(line);
		const reasons: Because[] = [];
		for (const c of line.cells) {
			if (c === target) continue;
			const have = known(cand.board, axis)[c];
			if (have >= 0) {
				reasons.push({ says: [cell(c), ' already has ', val(axis, have)], cells: [], about: c });
				continue;
			}
			const b = blockOf(cand, c, axis, value)!;
			reasons.push({ ...b, says: ['not ', cell(c), ': ', ...b.says], about: c });
		}
		return {
			...base,
			where: ['Look at ', cell(target), ' in ', name, '.'],
			focus: line.cells,
			question: ['Where can ', val(axis, value), ' go in ', name, '?'],
			reasons,
			answer: ['Only ', cell(target), ' is left, so it is ', val(axis, value), '.'],
		};
	}

	if (step.technique === 'lastOption') {
		const reasons: Because[] = [];
		for (let w = 0; w < 4; w++) {
			if (w === value) continue;
			const b = blockOf(cand, target, axis, w)!;
			reasons.push({ ...b, says: ['not ', val(axis, w), ': ', ...b.says] });
		}
		return {
			...base,
			where: ['Look at ', cell(target), '.'],
			focus: [target],
			question: [axis === 'num' ? 'Which number' : 'Which color', ' can ', cell(target), ' be?'],
			reasons,
			answer: ['Only ', val(axis, value), ' is left.'],
		};
	}

	// Pair hunt: list the tiles that could still take the number (or the color,
	// whichever list is shorter) and say why each other one can't hold the pair.
	const p = step.pair!;
	const n = p >> 2;
	const k = p & 3;
	const openTo = (ax: Axis, v: number) =>
		Array.from({ length: CELLS }, (_, c) => c).filter((c) => {
			const have = known(cand.board, ax)[c];
			return have === v || (have < 0 && cand.options(c, ax) & (1 << v));
		});
	const byNum = openTo('num', n);
	const byColor = openTo('color', k);
	const group = byNum.length <= byColor.length ? { ax: 'num' as Axis, v: n, cells: byNum } : { ax: 'color' as Axis, v: k, cells: byColor };
	const reasons: Because[] = [];
	for (const c of group.cells) {
		if (c === target) continue;
		const b = pairBlock(cand, c, n, k);
		reasons.push({ ...b, says: ['not ', cell(c), ': ', ...b.says], about: c });
	}
	const pairTok: Token = { t: 'pair', n, c: k };
	return {
		...base,
		where: ['Look at ', cell(target), '. Think about pairs.'],
		focus: group.cells,
		question: [
			'Every pair is used once. Where can the ',
			pairTok,
			' go? Tiles that can still be ',
			val(group.ax, group.v),
			': ',
			...group.cells.flatMap((c, i) => (i ? [', ', cell(c)] : [cell(c)])),
			'.',
		],
		reasons,
		answer: ['Only ', cell(target), ' can hold the ', pairTok, '.'],
	};
}
