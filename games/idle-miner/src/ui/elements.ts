// The elements of the page that the UI reads and writes.

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export const canvas = $<HTMLCanvasElement>('stage');

export const ui = {
	dock: $('dock'),
	hud: $('hud'),
	credits: $('credits'),
	income: $('income'),
	dust: $('dust'),
	dustN: $('dust-n'),
	research: $('btn-research'),
	nova: $('btn-nova'),
	goal: $('goal'),
	goalTag: $('goal-tag'),
	goalText: $('goal-text'),
	goalFill: $('goal-fill'),
	pvTop: $('pv-top'),
	pvName: $('pv-name'),
	pvSub: $('pv-sub'),
	crew: $('btn-crew'),
	survey: $('btn-survey'),
	card: $('planet-card'),
	toolbar: $('toolbar'),
	inspect: $('inspect'),
	toasts: $('toasts'),
	coach: $('coach'),
	coachText: $('coach-text'),
	title: $('title'),
	play: $('btn-play'),
	newGame: $('btn-new'),
};
