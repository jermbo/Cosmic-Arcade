/**
 * Plays each junction many times with random inputs, with no browser.
 * It shows what scores are possible, to set the goals, and checks that a replay gives the same run.
 * Run: npm run bot
 */
import { LEVELS } from '../src/levels/index.ts';
import { makeRng } from '../src/sim/rng.ts';
import { quantize } from '../src/sim/replay.ts';
import { initPhysics, Sim } from '../src/sim/sim.ts';
import type { StepInput } from '../src/sim/sim.ts';
import type { LevelDef } from '../src/levels/types.ts';

interface Plan {
	aimSteps: number;
	aim: number;
	steer: number;
	pushX: number;
	pushZ: number;
	breakerAt: number;
}

function play(level: LevelDef, plan: Plan) {
	const sim = new Sim(level);
	const input: StepInput = { aim: 0, launch: false, steer: 0, nx: 0, nz: 0, breaker: false };
	let crashSteps = 0;
	let steps = 0;
	let firstHit = false;
	while (sim.phase !== 'done' && steps < 60 * 200) {
		input.aim = plan.aim;
		input.launch = sim.phase === 'aim' && steps >= plan.aimSteps;
		input.steer = sim.phase === 'crash' ? 0 : plan.steer;
		input.nx = sim.phase === 'crash' ? plan.pushX : 0;
		input.nz = sim.phase === 'crash' ? plan.pushZ : 0;
		if (sim.phase === 'crash') crashSteps++;
		input.breaker = crashSteps === plan.breakerAt;
		sim.step(quantize(input));
		for (const e of sim.events) if (e.type === 'firstHit') firstHit = true;
		sim.events.length = 0;
		steps++;
	}
	const result = { money: sim.money, chain: sim.bestChain, wrecks: sim.wrecks, bonus: { ...sim.bonus }, time: sim.time, firstHit, px: sim.player.pos[0], pz: sim.player.pos[2] };
	sim.free();
	return result;
}

await initPhysics();
const runs = Number(process.argv[2] ?? 40);
for (const level of LEVELS) {
	const rng = makeRng(7);
	const results = [];
	let ms = 0;
	for (let i = 0; i < runs; i++) {
		const plan: Plan = {
			aimSteps: Math.floor(rng() * 900),
			aim: (rng() * 2 - 1) * level.launch.arc,
			steer: (rng() * 2 - 1) * 0.5,
			pushX: rng() * 2 - 1,
			pushZ: rng() * 2 - 1,
			breakerAt: 30 + Math.floor(rng() * 150),
		};
		const start = performance.now();
		const a = play(level, plan);
		ms += performance.now() - start;
		if (i < 3) {
			const b = play(level, plan);
			if (a.money !== b.money || a.px !== b.px || a.pz !== b.pz) console.log(`  !! ${level.id}: a replay gave a different run (${a.money} vs ${b.money})`);
		}
		results.push(a);
	}
	results.sort((x, y) => x.money - y.money);
	const pick = (f: number) => results[Math.min(results.length - 1, Math.floor(f * results.length))];
	const max = (key: 'chain' | 'wrecks' | 'time') => Math.max(...results.map((r) => r[key]));
	const hits = results.filter((r) => r.firstHit).length;
	console.log(
		`${level.id.padEnd(16)} money p10 ${pick(0.1).money} p50 ${pick(0.5).money} p90 ${pick(0.9).money} max ${pick(1).money} | chain p50 ${pick(0.5).chain} max ${max('chain')} | wrecks max ${max('wrecks')} | time max ${max('time').toFixed(1)} | hit ${hits}/${runs} | ${(ms / runs).toFixed(0)} ms/run`,
	);
	const best = pick(1);
	console.log(`  best: wrecks ${best.wrecks} chain ${best.chain} bonus ${JSON.stringify(best.bonus)} time ${best.time.toFixed(1)}`);
}
