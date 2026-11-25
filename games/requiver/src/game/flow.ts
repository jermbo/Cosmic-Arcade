// Moves the player between screens and resolves what waits at each spot.

import { ACTS } from '../rules/data/acts.ts';
import { BOOSTS } from '../rules/data/boosts.ts';
import { unlocks } from '../rules/meta.ts';
import { newSeed } from '../rules/rng.ts';
import { buyItem, chooseEvent, claimReward, continueEvent, endRun, enterSpot, leaveSpot, newRun, rest, type RunState } from '../rules/run.ts';
import { banner, clearLayers } from '../ui/dom.ts';
import { bowPanel, eventPanel, eventResultPanel, restPanel, rewardPanel, shopPanel } from '../ui/panels.ts';
import { sfx } from './audio.ts';
import { k } from './k.ts';
import { game, persist } from './state.ts';

export const run = (): RunState | null => game.save.run;

export function goTitle() {
	clearLayers();
	k.go('title');
}

export function goMap() {
	clearLayers();
	k.go('map');
}

/** Asks for a bow when there is a choice, then starts a run. */
export function startNewRun(onCancel: () => void) {
	const open = unlocks(game.save.meta);
	const choices = ['short', 'long', 'twin'].filter((b) => open.has(`bow:${b}`));
	const start = (bow: string) => {
		game.save.meta.bow = bow;
		game.save.run = newRun(game.save.meta, bow, newSeed());
		persist();
		sfx('click');
		goMap();
	};
	if (!choices.length) start('ash');
	else bowPanel(start, onCancel);
}

export function continueRun() {
	const r = run();
	if (!r) return;
	if (r.pending?.kind === 'battle') {
		clearLayers();
		k.go('battle');
	} else goMap();
}

/** Called by the map when a spot is picked. */
export function pickSpot(id: number) {
	const r = run();
	if (!r) return;
	enterSpot(r, game.save.meta, id);
	persist();
	resolvePending();
}

/** Shows whatever waits at the current spot. Returns true when something is shown. */
export function resolvePending(): boolean {
	const r = run();
	if (!r) return false;
	const meta = game.save.meta;
	const p = r.pending;
	if (!p) return false;
	switch (p.kind) {
		case 'battle':
			clearLayers();
			k.go('battle');
			return true;
		case 'reward':
			if (p.taken) {
				leave();
				return true;
			}
			rewardPanel(r, p, {
				take: (offer, replace) => {
					claimReward(r, meta, { offer, replace });
					sfx('heal');
					banner(BOOSTS[offer.id].name, offer.upgrade ? `Level ${offer.level}` : 'New boost', false, 1100);
					leave();
				},
				slot: () => {
					claimReward(r, meta, { slot: true });
					leave();
				},
				skip: () => {
					claimReward(r, meta, { skip: true });
					leave();
				},
			});
			return true;
		case 'shop':
			shopPanel(r, p.items, {
				buy: (item, index) => {
					if (buyItem(r, meta, item, index)) {
						sfx('coin');
						persist();
					}
				},
				leave: () => leave(),
			});
			return true;
		case 'rest':
			if (p.done) {
				leave();
				return true;
			}
			restPanel(r, {
				heal: () => {
					rest(r, meta, { heal: true });
					sfx('heal');
					leave();
				},
				train: (i) => {
					rest(r, meta, { upgrade: i });
					sfx('heal');
					leave();
				},
			});
			return true;
		case 'event': {
			const showResult = () =>
				eventResultPanel(p.id, p.result!, () => {
					continueEvent(r);
					persist();
					if (!r.pending) leave();
					else resolvePending();
				});
			if (p.result !== null) showResult();
			else
				eventPanel(r, p.id, {
					choose: (i) => {
						chooseEvent(r, meta, i);
						persist();
						showResult();
					},
				});
			return true;
		}
	}
}

/** Leaves the spot. After a boss, the next act begins. */
export function leave() {
	const r = run();
	if (!r) return;
	const act = r.act;
	leaveSpot(r);
	persist();
	if (r.act !== act) {
		goMap();
		setTimeout(() => banner(`Act ${r.act + 1}`, ACTS[r.act].name, false, 2200), 350);
		return;
	}
	if (k.getSceneName() === 'map') {
		clearLayers();
		k.go('map');
	} else goMap();
}

/** Ends the run early from the pause menu. */
export function abandonRun() {
	const r = run();
	if (!r) return;
	endRun(r, game.save.meta, 'dead');
	persist();
	clearLayers();
	k.go('summary');
}
