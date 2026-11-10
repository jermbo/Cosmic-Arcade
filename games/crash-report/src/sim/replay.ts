import { CONFIG } from '../config.ts';
import type { LevelDef } from '../levels/types.ts';
import { hashText } from './rng.ts';
import type { Phase, StepInput } from './sim.ts';

/**
 * A replay is the list of inputs of a run. The sim gives the same run for the same inputs.
 * Inputs are rounded to small whole numbers before the sim reads them, so the saved
 * values and the played values are the same.
 */

export interface Replay {
	/** Changes when the tuning or the level changes. An old replay is then dropped. */
	version: number;
	/** Steps that the player spent in the aim phase. */
	aimSteps: number;
	/** Aim offset in hundredths of a degree. */
	aim: number;
	/** Three bytes for each step after the launch: flags, steer or push x, push z. */
	frames: number[];
}

export interface SavedReplay {
	version: number;
	aimSteps: number;
	aim: number;
	frames: string;
}

const FLAG_BREAKER = 1;

export function replayVersion(level: LevelDef): number {
	return hashText(JSON.stringify(CONFIG) + JSON.stringify(level) + 'r1');
}

export function newReplay(level: LevelDef): Replay {
	return { version: replayVersion(level), aimSteps: 0, aim: 0, frames: [] };
}

/** Rounds an input to the values that a replay can hold. */
export function quantize(input: StepInput): StepInput {
	input.aim = Math.round(input.aim * 100) / 100;
	input.steer = toByte(input.steer) / 127;
	input.nx = toByte(input.nx) / 127;
	input.nz = toByte(input.nz) / 127;
	return input;
}

/** Saves the input of one step. `phase` is the phase of the sim before the step. */
export function record(replay: Replay, input: StepInput, phase: Phase): void {
	if (phase === 'done') return;
	if (phase === 'aim' && !input.launch) {
		replay.aimSteps++;
		return;
	}
	if (input.launch) replay.aim = Math.round(input.aim * 100);
	const first = toByte(phase === 'crash' ? input.nx : input.steer);
	replay.frames.push(input.breaker ? FLAG_BREAKER : 0, first & 0xff, toByte(input.nz) & 0xff);
}

/** Reads the input of one step after the launch. `crashed` tells if the push or the steering is meant. */
export function readFrame(replay: Replay, index: number, crashed: boolean, out: StepInput): boolean {
	const i = index * 3;
	if (i >= replay.frames.length) return false;
	const first = fromByte(replay.frames[i + 1]) / 127;
	out.aim = replay.aim / 100;
	out.launch = index === 0;
	out.breaker = (replay.frames[i] & FLAG_BREAKER) !== 0;
	out.steer = crashed ? 0 : first;
	out.nx = crashed ? first : 0;
	out.nz = crashed ? fromByte(replay.frames[i + 2]) / 127 : 0;
	return true;
}

export function packReplay(replay: Replay): SavedReplay {
	let text = '';
	for (const byte of replay.frames) text += String.fromCharCode(byte);
	return { version: replay.version, aimSteps: replay.aimSteps, aim: replay.aim, frames: btoa(text) };
}

export function unpackReplay(saved: SavedReplay): Replay {
	const text = atob(saved.frames);
	const frames: number[] = [];
	for (let i = 0; i < text.length; i++) frames.push(text.charCodeAt(i));
	return { version: saved.version, aimSteps: saved.aimSteps, aim: saved.aim, frames };
}

function toByte(value: number): number {
	return Math.round(Math.max(-1, Math.min(1, value)) * 127);
}

function fromByte(byte: number): number {
	return byte > 127 ? byte - 256 : byte;
}
