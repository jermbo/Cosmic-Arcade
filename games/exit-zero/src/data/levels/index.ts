import type { LevelDef } from '../../core/types.ts';
import m0 from './m0.json';

/** Every level, by id. A level's `next` names the one that follows. */
export const LEVELS: Record<string, LevelDef> = {
	m0: m0 as unknown as LevelDef,
};

export const FIRST_LEVEL = 'm0';
