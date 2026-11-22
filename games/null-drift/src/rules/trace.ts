import type { Run } from './run.ts';

export const TRACE_LETHAL = 100;
export const TRACE_CAP = 120;
export const GATE_SHED = 0.35;

export function addTrace(run: Run, amount: number): void {
	run.trace = Math.min(TRACE_CAP, Math.max(0, run.trace + amount));
}

export const isBooted = (run: Run) => run.trace >= TRACE_LETHAL;

/** Whole number for display. Floored, so 99.6 never reads as 100. */
export const traceShown = (trace: number) => Math.floor(trace);
