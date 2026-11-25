import type { Cond } from './types.ts';

/** Everything that a checkpoint saves. World objects derive their look from it. */
export interface StateData {
	flags: string[];
	vars: Record<string, number>;
	inventory: string[];
	notes: string[];
}

export class GameState {
	flags = new Set<string>();
	vars: Record<string, number> = {};
	inventory: string[] = [];
	notes: string[] = [];

	has(item: string): boolean {
		return this.inventory.includes(item);
	}

	flag(name: string): boolean {
		return this.flags.has(name);
	}

	setFlag(name: string, value = true): void {
		if (value) this.flags.add(name);
		else this.flags.delete(name);
	}

	give(item: string): void {
		if (!this.has(item)) this.inventory.push(item);
	}

	take(item: string): void {
		this.inventory = this.inventory.filter((i) => i !== item);
	}

	addNote(id: string): void {
		if (!this.notes.includes(id)) this.notes.push(id);
	}

	check(cond: Cond | undefined): boolean {
		return check(cond, this);
	}

	toData(): StateData {
		return { flags: [...this.flags], vars: { ...this.vars }, inventory: [...this.inventory], notes: [...this.notes] };
	}

	load(data: StateData): void {
		this.flags = new Set(data.flags);
		this.vars = { ...data.vars };
		this.inventory = [...data.inventory];
		this.notes = [...data.notes];
	}
}

interface CondTarget {
	has(item: string): boolean;
	flag(name: string): boolean;
}

export function check(cond: Cond | undefined, s: CondTarget): boolean {
	if (cond === undefined || cond === true) return true;
	if ('item' in cond) return s.has(cond.item);
	if ('flag' in cond) return s.flag(cond.flag);
	if ('not' in cond) return !check(cond.not, s);
	if ('all' in cond) return cond.all.every((c) => check(c, s));
	if ('any' in cond) return cond.any.some((c) => check(c, s));
	return false;
}
