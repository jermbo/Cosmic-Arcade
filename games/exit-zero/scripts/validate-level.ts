// Checks each level file: references, entity spots, and that the slice can be finished.
// Run: npm run validate -w exit-zero
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Grid } from '../src/core/grid.ts';
import { GameState } from '../src/core/state.ts';
import type { Action, Cond, EntityDef, LevelDef, StoryDef } from '../src/core/types.ts';

const dataDir = fileURLToPath(new URL('../src/data/', import.meta.url));
const read = (p: string) => JSON.parse(readFileSync(join(dataDir, p), 'utf8'));
const story: StoryDef = read('story.json');
const items: Record<string, unknown> = read('items.json');
const notes: Record<string, unknown> = read('notes.json');
const textures = ['carpet', 'carpetDark', 'wallpaper', 'wallpaperStained', 'ceilingTile', 'concrete', 'cinder', 'concreteCeil', 'grating', 'metalPanel', 'tileGreen', 'tileWhite'];

let errors = 0;
const fail = (msg: string) => {
	errors++;
	console.error(`  x ${msg}`);
};

for (const file of readdirSync(join(dataDir, 'levels')).filter((f) => f.endsWith('.json'))) {
	const level: LevelDef = read(`levels/${file}`);
	console.log(`Level ${level.id} (${file})`);
	const grid = new Grid(level);
	checkRefs(level, grid);
	solve(level, grid);
}

if (errors) {
	console.error(`${errors} problem(s).`);
	process.exit(1);
}
console.log('All levels are valid.');

function text(key: unknown, where: string) {
	if (typeof key !== 'string') return;
	if (!(key in story.text)) fail(`${where}: no text "${key}" in story.json`);
}

function checkActions(list: Action[] | undefined, where: string, level: LevelDef) {
	for (const a of list ?? []) {
		if (a.do === 'say') text(a.text, where);
		if (a.do === 'give' || a.do === 'take') if (!(a.item in items)) fail(`${where}: no item "${a.item}"`);
		if (a.do === 'note' && !(a.note in notes)) fail(`${where}: no note "${a.note}"`);
		if (a.do === 'checkpoint' && !(a.id in level.checkpoints)) fail(`${where}: no checkpoint "${a.id}"`);
		if (a.do === 'tutorial' && !(a.id in story.tutorial)) fail(`${where}: no tutorial "${a.id}"`);
		if (a.do === 'if') {
			checkActions(a.then, where, level);
			checkActions(a.else, where, level);
		}
	}
}

function checkRefs(level: LevelDef, grid: Grid) {
	text(level.name, 'level name');
	for (const row of level.map) for (const ch of row) if (!(ch in level.zones)) fail(`map char "${ch}" has no zone`);
	for (const [ch, z] of Object.entries(level.zones)) {
		if (z.solid) continue;
		for (const t of [z.floor, z.wall, z.ceiling]) if (!textures.includes(t)) fail(`zone "${ch}": unknown texture "${t}"`);
		if (!(z.area in story.areas)) fail(`zone "${ch}": no area "${z.area}" in story.json`);
	}
	for (const [id, cp] of Object.entries(level.checkpoints)) {
		if (grid.solid(Math.floor(cp.at[0]), Math.floor(cp.at[1]))) fail(`checkpoint ${id} is in a wall`);
	}
	const ids = new Set<string>();
	for (const e of level.entities) {
		const where = `${e.type} "${e.id}"`;
		if (ids.has(e.id)) fail(`${where}: the id is used twice`);
		ids.add(e.id);
		if (grid.solid(Math.floor(e.at[0]), Math.floor(e.at[1]))) fail(`${where} is in a wall at ${e.at}`);
		for (const k of ['sign', 'text', 'lockedText', 'openText', 'label', 'name', 'deadText']) text(e[k], where);
		if (typeof e.item === 'string' && !(e.item in items)) fail(`${where}: no item "${e.item}"`);
		if (typeof e.note === 'string' && !(e.note in notes)) fail(`${where}: no note "${e.note}"`);
		for (const k of ['actions', 'onOpen', 'onSolve', 'onDone', 'onPick']) checkActions(e[k] as Action[], where, level);
		for (const s of (e.switches as EntityDef[] | undefined) ?? []) {
			text(s.label, where);
			checkActions(s.onOn as Action[], where, level);
			checkActions(s.onOff as Action[], where, level);
		}
		for (const s of (e.steps as { needs?: string; prompt: string; done?: string }[] | undefined) ?? []) {
			text(s.prompt, where);
			text(s.done, where);
			if (s.needs && !(s.needs in items)) fail(`${where}: step needs unknown item "${s.needs}"`);
		}
		for (const p of (e.patrol as [number, number][] | undefined) ?? []) {
			if (grid.solid(Math.floor(p[0]), Math.floor(p[1]))) fail(`${where}: patrol point ${p} is in a wall`);
		}
	}
}

/** Plays the level as a greedy puzzle solver: take what is reachable, open what can be opened. */
function solve(level: LevelDef, grid: Grid) {
	const s = new GameState();
	for (const f of level.initialFlags) s.setFlag(f);
	for (const i of level.startItems) s.give(i);
	const log: string[] = [];
	const done = new Set<string>();
	const gateFlags = new Set<string>();
	const collect = (c: Cond | undefined) => {
		if (!c || c === true) return;
		if ('flag' in c) gateFlags.add(c.flag);
		if ('all' in c) c.all.forEach(collect);
		if ('any' in c) c.any.forEach(collect);
		if ('not' in c) collect(c.not);
	};
	for (const e of level.entities) if (e.type === 'gate') collect(e.open as Cond);

	const run = (list: Action[] | undefined) => {
		for (const a of list ?? []) {
			if (a.do === 'setFlag') s.setFlag(a.flag, a.value ?? true);
			if (a.do === 'give') s.give(a.item);
			if (a.do === 'take') s.take(a.item);
			if (a.do === 'note') s.addNote(a.note);
			if (a.do === 'if') run(s.check(a.cond) ? a.then : a.else);
		}
	};
	const live = level.entities.filter((e) => e.type === 'hazardWater');

	const reachable = () => {
		grid.blocked.clear();
		for (const e of level.entities) {
			const cell = `${Math.floor(e.at[0])},${Math.floor(e.at[1])}`;
			if (e.type === 'door' && !s.flag(`open.${e.id}`)) grid.blocked.add(cell);
			if (e.type === 'gate' && !s.check(e.open as Cond)) grid.blocked.add(cell);
		}
		for (const h of live) {
			if (!s.check(h.live as Cond)) continue;
			for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w; x++) if (grid.char(x, y) === h.char) grid.blocked.add(`${x},${y}`);
		}
		const spot = level.checkpoints[level.start];
		const seen = new Set<string>();
		const q: [number, number][] = [[Math.floor(spot.at[0]), Math.floor(spot.at[1])]];
		seen.add(q[0].join(','));
		while (q.length) {
			const [x, y] = q.shift()!;
			for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
				const k = `${nx},${ny}`;
				if (seen.has(k) || grid.solid(nx, ny)) continue;
				seen.add(k);
				if (!grid.blocked.has(k)) q.push([nx, ny]);
			}
		}
		return seen;
	};

	let won = false;
	for (let round = 0; round < 50 && !won; round++) {
		const cells = reachable();
		let progress = false;
		for (const e of level.entities) {
			if (done.has(e.id) || !cells.has(`${Math.floor(e.at[0])},${Math.floor(e.at[1])}`)) continue;
			const act = (msg: string) => {
				done.add(e.id);
				log.push(msg);
				progress = true;
			};
			switch (e.type) {
				case 'pickup':
					if (!s.check(e.when as Cond)) break;
					if (e.item) s.give(e.item as string);
					if (e.note) s.addNote(e.note as string);
					run(e.onPick as Action[]);
					act(`pick up ${e.item ?? e.note}`);
					break;
				case 'door':
					if (!s.check(e.requires as Cond)) break;
					s.setFlag(`open.${e.id}`);
					run(e.onOpen as Action[]);
					act(`open ${e.id}`);
					break;
				case 'keypad':
					s.setFlag(`solved.${e.id}`);
					run(e.onSolve as Action[]);
					act(`solve keypad ${e.id}`);
					break;
				case 'repair': {
					const steps = e.steps as { needs?: string; consume?: boolean }[];
					if (!steps.every((st) => !st.needs || s.has(st.needs))) break;
					for (const st of steps) if (st.consume && st.needs) s.take(st.needs);
					s.setFlag(e.doneFlag as string);
					run(e.onDone as Action[]);
					act(`repair ${e.id}`);
					break;
				}
				case 'breakers': {
					const powered = s.check(e.power as Cond);
					for (const sw of e.switches as { id: string; flag: string; needsPower?: boolean; onOn?: Action[] }[]) {
						if (s.flag(sw.flag) || !gateFlags.has(sw.flag) || (sw.needsPower && !powered)) continue;
						s.setFlag(sw.flag);
						run(sw.onOn);
						log.push(`switch on ${sw.id}`);
						progress = true;
					}
					break;
				}
				case 'trigger':
					if (!s.check(e.when as Cond)) break;
					run(e.actions as Action[]);
					done.add(e.id);
					break;
				case 'exit':
					act('reach the exit');
					won = true;
					break;
			}
		}
		if (!progress) break;
	}
	if (won) console.log(`  ok: the slice can be finished: ${log.join(' > ')}`);
	else fail(`the exit can't be reached. Got as far as: ${log.join(' > ') || 'nothing'}`);
}
