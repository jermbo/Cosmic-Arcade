// Headless sim: plays full runs with the rules modules only, and reports balance, pacing and dead ends.
// Run: npm run sim            (all checks)
//      npm run sim -- --runs 60 --skill average
import { Battle } from '../src/rules/combat.ts';
import { Bot, SKILLS, type BotSkill } from '../src/rules/bot.ts';
import { ACTS } from '../src/rules/data/acts.ts';
import { BOOSTS } from '../src/rules/data/boosts.ts';
import { EVENTS } from '../src/rules/data/events.ts';
import { UPGRADES } from '../src/rules/data/upgrades.ts';
import { allPaths, checkMap, generateMap, nodeById } from '../src/rules/map.ts';
import { buy, buyState, newMeta, nextCost, type MetaState } from '../src/rules/meta.ts';
import { Rng } from '../src/rules/rng.ts';
import {
	battleSetup,
	buyItem,
	canBuy,
	chooseEvent,
	choiceOpen,
	choices,
	claimReward,
	continueEvent,
	enterSpot,
	finishBattle,
	leaveSpot,
	needsReplace,
	newRun,
	rest,
	runStats,
	upgradable,
	type RunState,
} from '../src/rules/run.ts';

const args = process.argv.slice(2);
const arg = (name: string, fallback: string) => {
	const i = args.indexOf(`--${name}`);
	return i >= 0 ? args[i + 1] : fallback;
};
const RUNS = Number(arg('runs', '40'));
const ONLY_SKILL = arg('skill', '');
const STEP = 1 / 60;
const BATTLE_LIMIT = 420;

const problems: string[] = [];
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '-');
const avg = (list: number[]) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0);
const fmt = (n: number, digits = 1) => n.toFixed(digits);

// ---------- 1. Maps ----------

function mapCheck() {
	let bad = 0;
	const pathLens: number[] = [];
	const counts: Record<string, number[]> = {};
	for (let act = 0; act < ACTS.length; act++) {
		for (let i = 0; i < 1500; i++) {
			const map = generateMap(new Rng(i * 7 + act), act);
			const p = checkMap(map);
			if (p.length) {
				bad++;
				if (bad < 4) problems.push(`map act ${act + 1} seed ${i}: ${p.join('; ')}`);
			}
			const paths = allPaths(map);
			for (const path of paths) {
				pathLens.push(path.length);
				const fights = path.filter((t) => t === 'fight' || t === 'elite').length;
				(counts.fightsPerPath ??= []).push(fights);
				if (fights < 2) problems.push(`map act ${act + 1} seed ${i}: a path with only ${fights} fights`);
			}
			for (const n of map.nodes) (counts[n.type] ??= []).push(1);
			(counts.choicesPerMap ??= []).push(paths.length);
		}
	}
	const total = 1500 * ACTS.length;
	console.log('\n== Maps ==');
	console.log(`maps: ${total}, broken: ${bad}, path length: ${fmt(avg(pathLens))} spots, paths per map: ${fmt(avg(counts.choicesPerMap))}`);
	console.log(`fights per path: ${fmt(avg(counts.fightsPerPath))} (min ${Math.min(...counts.fightsPerPath)})`);
	const types = Object.keys(counts).filter((k) => !k.includes('Per'));
	console.log('spots per map: ' + types.map((t) => `${t} ${fmt(counts[t].length / total)}`).join(', '));
}

// ---------- 2. Data ----------

function dataCheck() {
	for (const e of Object.values(EVENTS)) {
		const open = e.choices.filter((c) => !c.needs || Object.keys(c.needs).length === 0);
		if (!open.length) problems.push(`event ${e.id}: every choice has a cost; a broke player is stuck`);
	}
	for (const u of Object.values(UPGRADES)) for (const r of u.requires) if (!UPGRADES[r]) problems.push(`upgrade ${u.id} needs unknown ${r}`);
	for (const b of Object.values(BOOSTS)) if (b.text.length !== b.levels.length) problems.push(`boost ${b.id}: ${b.text.length} texts for ${b.levels.length} levels`);
}

// ---------- 3. Runs ----------

interface BattleLog {
	act: number;
	kind: string;
	won: boolean;
	time: number;
	hpLost: number;
	shots: number;
	hits: number;
	kills: number;
	bonus: number;
}

function playBattle(run: RunState, meta: MetaState, skill: BotSkill, rng: Rng, logs: BattleLog[]) {
	const setup = battleSetup(run, meta)!;
	const battle = new Battle(setup);
	const bot = new Bot(skill, rng);
	const startHp = battle.hp;
	let t = 0;
	while (!battle.outcome && t < BATTLE_LIMIT) {
		bot.step(battle, STEP);
		battle.update(STEP);
		battle.drain();
		t += STEP;
	}
	if (!battle.outcome) {
		problems.push(`battle timeout: act ${setup.act + 1} ${setup.kind}, ${battle.enemies.length} foes left, wave ${battle.waveIndex + 1}/${battle.waves.length}, boss ${battle.boss?.bs?.phase}`);
		battle.hp = 0;
	}
	logs.push({
		act: setup.act,
		kind: setup.kind,
		won: battle.outcome === 'won',
		time: battle.tally.time,
		hpLost: startHp - Math.max(0, battle.hp),
		shots: battle.tally.shots,
		hits: battle.tally.hits,
		kills: battle.tally.kills,
		bonus: battle.tally.bonusShots,
	});
	finishBattle(run, meta, battle.outcome ?? 'lost', battle.hp, battle.tally);
}

/** Picks the best offer: level ups first, then rare ones. Returns the slot to replace too. */
function pickOffer(run: RunState, meta: MetaState, offers: { id: string; level: number; upgrade: boolean }[], rng: Rng) {
	const rank = { rare: 3, uncommon: 2, common: 1 } as Record<string, number>;
	const sorted = [...offers].sort((a, b) => (b.upgrade ? 5 : rank[BOOSTS[b.id].rarity]) - (a.upgrade ? 5 : rank[BOOSTS[a.id].rarity]) + rng.range(-0.5, 0.5));
	const offer = sorted[0];
	if (!offer) return null;
	let replace: number | undefined;
	if (needsReplace(run, meta, offer)) {
		const lowest = run.boosts.map((b, i) => ({ b, i })).sort((x, y) => x.b.level - y.b.level)[0];
		if (lowest.b.level > 1) return null;
		replace = lowest.i;
	}
	return { offer, replace };
}

function playRun(meta: MetaState, skill: BotSkill, seed: number, logs: BattleLog[], boostPicks: Record<string, number>) {
	const rng = new Rng(seed ^ 0x9e3779b9);
	const run = newRun(meta, meta.bow, seed);
	let guard = 0;
	while (!run.result && guard++ < 400) {
		const p = run.pending;
		if (!p) {
			const list = choices(run);
			if (!list.length) {
				problems.push(`dead end on the map: act ${run.act + 1} at ${run.at}`);
				break;
			}
			const stats = runStats(run, meta);
			const low = run.hp < stats.maxHp * 0.45;
			const score = (type: string) => {
				if (type === 'rest' || type === 'shop') return low ? 4 : 1;
				if (type === 'elite') return low ? 0 : skill.name === 'skilled' ? 3 : 1;
				if (type === 'treasure') return 3;
				if (type === 'event') return 2;
				return 2;
			};
			const pick = [...list].sort((a, b) => score(b.type) - score(a.type) + rng.range(-1.2, 1.2))[0];
			enterSpot(run, meta, pick.id);
			continue;
		}
		switch (p.kind) {
			case 'battle':
				playBattle(run, meta, skill, rng, logs);
				break;
			case 'reward': {
				if (!p.taken) {
					if (p.slot) claimReward(run, meta, { slot: true });
					else {
						const choice = pickOffer(run, meta, p.offers, rng);
						if (choice) {
							claimReward(run, meta, { offer: choice.offer, replace: choice.replace });
							boostPicks[choice.offer.id] = (boostPicks[choice.offer.id] ?? 0) + 1;
						} else claimReward(run, meta, { skip: true });
					}
				}
				leaveSpot(run);
				break;
			}
			case 'shop': {
				const stats = runStats(run, meta);
				for (const item of p.items) {
					if (!canBuy(run, meta, item)) continue;
					if (item.kind === 'heal' && run.hp < stats.maxHp * 0.6) buyItem(run, meta, item);
					else if (item.kind === 'boost' && item.offer) {
						const c = pickOffer(run, meta, [item.offer], rng);
						if (c) buyItem(run, meta, item, c.replace);
					} else if (item.kind === 'upgrade') {
						const list = upgradable(run);
						if (list.length) buyItem(run, meta, item, list[0]);
					} else if (item.kind === 'slot') buyItem(run, meta, item);
				}
				leaveSpot(run);
				break;
			}
			case 'rest': {
				const stats = runStats(run, meta);
				const list = upgradable(run);
				if (run.hp < stats.maxHp * 0.7 || !list.length) rest(run, meta, { heal: true });
				else rest(run, meta, { upgrade: list[0] });
				leaveSpot(run);
				break;
			}
			case 'event': {
				if (p.result === null) {
					const ev = EVENTS[p.id];
					const open = ev.choices.map((c, i) => ({ c, i })).filter(({ c }) => choiceOpen(run, c));
					if (!open.length) {
						problems.push(`event ${p.id}: no open choice (gold ${run.gold}, hp ${run.hp})`);
						leaveSpot(run);
						break;
					}
					chooseEvent(run, meta, rng.pick(open).i);
				}
				continueEvent(run);
				if (!run.pending) leaveSpot(run);
				break;
			}
		}
	}
	if (!run.result) problems.push(`run did not end (seed ${seed})`);
	return run;
}

function runBatch(label: string, skill: BotSkill, meta: MetaState, runs: number) {
	const logs: BattleLog[] = [];
	const picks: Record<string, number> = {};
	const results: RunState[] = [];
	for (let i = 0; i < runs; i++) {
		const m = structuredClone(meta);
		results.push(playRun(m, skill, 1000 + i * 31, logs, picks));
	}
	const wins = results.filter((r) => r.result === 'won').length;
	const deathAct = [0, 0, 0];
	for (const r of results) if (r.result === 'dead') deathAct[r.act]++;
	const bossLogs = logs.filter((l) => l.kind === 'boss');
	console.log(`\n-- ${label} --`);
	console.log(`win ${pct(wins, runs)} | deaths in act 1/2/3: ${deathAct.join(' / ')} | score ${Math.round(avg(results.map((r) => r.score)))} | feathers ${fmt(avg(results.map((r) => r.feathers)))}`);
	console.log(`run time ${fmt(avg(results.map((r) => r.tally.time)) / 60)} min of fighting | accuracy ${pct(avg(logs.map((l) => l.hits)), avg(logs.map((l) => l.shots)))} | bonus shots per fight ${fmt(avg(logs.map((l) => l.bonus)), 2)}`);
	for (let act = 0; act < 3; act++) {
		for (const kind of ['fight', 'elite', 'boss']) {
			const l = logs.filter((x) => x.act === act && x.kind === kind);
			if (!l.length) continue;
			console.log(
				`  act ${act + 1} ${kind.padEnd(5)} n=${String(l.length).padStart(3)} win ${pct(l.filter((x) => x.won).length, l.length).padStart(4)} | ${fmt(avg(l.map((x) => x.time)), 0).padStart(3)}s | hp lost ${fmt(avg(l.map((x) => x.hpLost))).padStart(5)} | kills ${fmt(avg(l.map((x) => x.kills)))}`,
			);
		}
	}
	void bossLogs;
	return { wins, results, picks };
}

/** A player who buys upgrades between runs. How many runs to the first win? */
function campaign(skill: BotSkill, maxRuns: number) {
	const meta = newMeta();
	meta.tutorialDone = true;
	const order = Object.values(UPGRADES).sort((a, b) => a.tier - b.tier || a.cost[0] - b.cost[0]);
	let firstWin = -1;
	const featherLog: number[] = [];
	for (let i = 0; i < maxRuns; i++) {
		const logs: BattleLog[] = [];
		const run = playRun(meta, skill, 5000 + i * 17, logs, {});
		featherLog.push(run.feathers);
		if (run.result === 'won' && firstWin < 0) firstWin = i + 1;
		for (let pass = 0; pass < 3; pass++) for (const u of order) if (buyState(meta, u.id) === 'buy') buy(meta, u.id);
	}
	const spent = Object.entries(meta.ranks).reduce((sum, [id, r]) => sum + UPGRADES[id].cost.slice(0, r).reduce((a, b) => a + b, 0), 0);
	const total = Object.values(UPGRADES).reduce((sum, u) => sum + u.cost.reduce((a, b) => a + b, 0), 0);
	const left = Object.values(UPGRADES).filter((u) => nextCost(meta, u.id) !== null).length;
	console.log(`\n-- campaign, ${skill.name}: first win on run ${firstWin < 0 ? 'never' : firstWin} of ${maxRuns} | feathers per run ${fmt(avg(featherLog))} | tree ${spent}/${total} spent, ${left} nodes left`);
	return firstWin;
}

function maxedMeta(): MetaState {
	const meta = newMeta();
	meta.tutorialDone = true;
	for (const u of Object.values(UPGRADES)) meta.ranks[u.id] = u.cost.length;
	return meta;
}

// ---------- Main ----------

console.log('ReQuiver sim');
dataCheck();
mapCheck();

const fresh = newMeta();
fresh.tutorialDone = true;
const skills = ONLY_SKILL ? [SKILLS[ONLY_SKILL]] : Object.values(SKILLS);
console.log('\n== Runs: fresh save ==');
const freshResults = skills.map((s) => runBatch(`${s.name}, no upgrades`, s, fresh, RUNS));
console.log('\n== Runs: full upgrade tree ==');
for (const s of skills) runBatch(`${s.name}, all upgrades`, s, maxedMeta(), RUNS);

console.log('\n== Tutorial run ==');
{
	const logs: BattleLog[] = [];
	const run = playRun(newMeta(), SKILLS.novice, 77, logs, {});
	const first = logs[0];
	console.log(`first fight: ${first?.won ? 'won' : 'lost'} in ${fmt(first?.time ?? 0, 0)}s, hp lost ${first?.hpLost}; run reached act ${run.act + 1}`);
}

console.log('\n== Campaigns ==');
for (const s of skills) campaign(s, 40);

const picks = freshResults.reduce<Record<string, number>>((acc, r) => {
	for (const [k, v] of Object.entries(r.picks)) acc[k] = (acc[k] ?? 0) + v;
	return acc;
}, {});
console.log('\nboost picks: ' + Object.entries(picks).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));

void nodeById;
const unique = [...new Set(problems)];
console.log(`\n== Problems: ${unique.length} ==`);
for (const p of unique.slice(0, 40)) console.log(' - ' + p);
process.exitCode = unique.length ? 1 : 0;
