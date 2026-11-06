import * as THREE from 'three';
import type { Branch, TowerId } from './data/towers';
import type { Cell } from './game/board';
import type { Game } from './game/game';

// A simple player for testing balance with ?debug. It builds where the most road is in range,
// calls each wave when the last one is over, and spends its gold on new towers and upgrades.

export interface BotOptions {
	/** New towers per wave. Lower is a lazier player. */
	density?: number;
	order?: TowerId[];
	/** Calls the next wave as soon as it can. */
	rush?: boolean;
}

const RANGES: Record<TowerId, number> = { ballista: 3.2, cannon: 2.7, crystal: 2.0, catapult: 4.6 };

export function runBot(game: Game, options: BotOptions = {}): string[] {
	const board = game.board;
	const sample = (routes: typeof board.routes): THREE.Vector3[] => {
		const out: THREE.Vector3[] = [];
		for (const route of routes) for (let d = 0; d < route.total; d += 0.25) out.push(route.at(d, new THREE.Vector3()));
		return out;
	};
	const road = sample(board.routes);
	const air = sample(board.flyRoutes);
	const cover = (cell: Cell, range: number, points: THREE.Vector3[]): number => {
		const at = board.world(cell.c, cell.r);
		return points.filter((p) => (p.x - at.x) ** 2 + (p.z - at.z) ** 2 <= range * range).length;
	};
	const order = options.order ?? ['ballista', 'cannon', 'ballista', 'crystal', 'catapult', 'cannon', 'ballista', 'catapult', 'crystal', 'cannon'];
	let next = 0;
	let flip = 0;
	const log: string[] = [];

	const bestCell = (id: TowerId): Cell | null => {
		let best: Cell | null = null;
		let score = -1;
		for (const column of board.cells) {
			for (const cell of column) {
				if (!board.buildable(cell)) continue;
				const s = cover(cell, RANGES[id], road) + (id === 'ballista' ? cover(cell, RANGES[id], air) * 0.5 : 0);
				if (s > score) {
					score = s;
					best = cell;
				}
			}
		}
		return best;
	};

	const spend = (): void => {
		for (let guard = 0; guard < 50; guard++) {
			const want = Math.floor(3 + game.wave * (options.density ?? 0.9));
			if (game.towers.length < want) {
				const id = order[next % order.length];
				const cell = bestCell(id);
				if (cell && game.canBuild(id, cell)) {
					game.build(id, cell);
					next += 1;
					continue;
				}
				if (!cell || game.gold < 200) break;
			}
			const upgrades = game.towers
				.filter((t) => t.level < 3)
				.map((t) => {
					const branch: Branch | undefined = t.level === 2 ? ((flip + t.cell.c) % 2 ? 'a' : 'b') : undefined;
					return { t, branch, cost: t.upgradeCost(branch) ?? Infinity };
				})
				.sort((a, b) => a.cost - b.cost);
			const pick = upgrades[0];
			if (pick && game.gold >= pick.cost) {
				game.upgrade(pick.t, pick.branch);
				flip += 1;
				continue;
			}
			break;
		}
		game.select(null);
	};

	let ticks = 0;
	let lives = game.lives;
	while (!game.over && ticks < 6000) {
		if (game.canCallWave && (!game.waveRunning || options.rush)) {
			spend();
			if (game.wave > 0) log.push(`wave ${game.wave}: lives ${game.lives} (-${lives - game.lives}) gold ${game.gold} towers ${game.towers.length}`);
			lives = game.lives;
			game.callWave();
		}
		for (let i = 0; i < 10; i++) game.update(0.1);
		ticks += 1;
		if (ticks % 5 === 0) spend();
	}
	const towers = game.towers.map((t) => `${t.def.id.slice(0, 3)}${t.level}${t.branch ?? ''}`).join(' ');
	log.push(`END wave ${game.wave}/${game.totalWaves} lives ${game.lives} gold ${game.gold} time ${game.time.toFixed(0)}s score ${game.score} | ${towers}`);
	return log;
}
