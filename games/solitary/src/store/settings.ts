import type { ModeId } from '../core/types.ts';
import { load, save } from './storage.ts';

export interface Settings {
	sound: boolean;
	showStats: boolean; // timer and move count
	hints: boolean;
	/** Send safe cards to the foundations by themselves. An accessibility aid, off by default. */
	autoMove: boolean;
	reduceMotion: boolean;
	theme: string;
	fourColor: boolean;
	klondikeDraw: 1 | 3;
	spiderSuits: 1 | 2 | 4;
	seenHowTo: Partial<Record<ModeId, boolean>>;
}

// v2: the deck pack and accessibility options. Old settings are dropped.
const KEY = 'solitary.settings.v2';

const DEFAULTS: Settings = {
	sound: true,
	showStats: true,
	hints: true,
	autoMove: false,
	reduceMotion: false,
	theme: 'teal',
	fourColor: false,
	klondikeDraw: 1,
	spiderSuits: 1,
	seenHowTo: {},
};

export const settings: Settings = load(KEY, DEFAULTS);

type Listener = () => void;
const listeners: Listener[] = [];

export function onSettings(fn: Listener) {
	listeners.push(fn);
}

export function updateSettings(patch: Partial<Settings>) {
	Object.assign(settings, patch);
	save(KEY, settings);
	for (const fn of listeners) fn();
}
