// Every menu and dialog of the game, built from the rules data.

import { META, SHOP } from '../rules/data/balance.ts';
import { BOOST_KIND_NAMES, BOOSTS, type BoostDef } from '../rules/data/boosts.ts';
import { BOWS } from '../rules/data/bows.ts';
import { EVENTS } from '../rules/data/events.ts';
import { BRANCH_NAMES, UPGRADES, type Branch } from '../rules/data/upgrades.ts';
import { buy, buyState, nextCost, rankOf, unlocks } from '../rules/meta.ts';
import { canBuy, choiceOpen, needsReplace, restHealAmount, runStats, upgradable, type Offer, type RunState, type ShopItem } from '../rules/run.ts';
import { sfx } from '../game/audio.ts';
import { applySettings, eraseSave, game, persist } from '../game/state.ts';
import { button, h, icon, panel, pop, type Layer } from './dom.ts';

// ---------- Boost cards ----------

export function boostCard(def: BoostDef, level: number, opts: { onClick?: () => void; price?: number; upgrade?: boolean; disabled?: boolean; picked?: boolean } = {}) {
	const pips = h('span', { class: 'pips', 'aria-label': `Level ${level} of ${def.levels.length}` });
	for (let i = 1; i <= def.levels.length; i++) pips.append(h('span', { class: `pip${i < level ? ' pip--on' : i === level ? (opts.upgrade ? ' pip--new' : ' pip--on') : ''}` }));
	const combos = def.combos.map((c) => BOOSTS[c]?.name).filter(Boolean);
	const card = h(
		'button',
		{ class: `card${opts.picked ? ' card--picked' : ''}`, type: 'button', disabled: opts.disabled || !opts.onClick, onclick: () => opts.onClick?.() },
		h(
			'div',
			{ class: 'card__top' },
			h('div', { class: `card__icon${def.rarity === 'rare' ? ' card__icon--rare' : ''}` }, icon(def.icon, 26)),
			h('div', {}, h('h3', { class: 'card__name' }, def.name), h('div', { class: 'card__meta' }, h('span', { class: 'tag' }, BOOST_KIND_NAMES[def.kind]), def.rarity !== 'common' ? h('span', { class: 'tag' }, def.rarity) : null, opts.upgrade ? h('span', { class: 'tag tag--accent' }, 'Level up') : null)),
		),
		pips,
		h('p', { class: 'card__text' }, def.text[Math.max(0, level - 1)]),
		combos.length ? h('p', { class: 'card__combo' }, `Combos with ${combos.join(', ')}`) : null,
		opts.price !== undefined ? h('span', { class: 'card__price' }, icon('coin', 14), String(opts.price)) : null,
	);
	return card;
}

function plainCard(iconName: string, title: string, text: string, onClick: (() => void) | null, price?: number, disabled = false) {
	return h(
		'button',
		{ class: 'card', type: 'button', disabled: disabled || !onClick, onclick: () => onClick?.() },
		h('div', { class: 'card__top' }, h('div', { class: 'card__icon' }, icon(iconName, 26)), h('h3', { class: 'card__name' }, title)),
		h('p', { class: 'card__text' }, text),
		price !== undefined ? h('span', { class: 'card__price' }, icon('coin', 14), String(price)) : null,
	);
}

// ---------- Rewards ----------

/** Lets the player drop a boost to make room. Calls back with the index, or null to cancel. */
export function replacePanel(run: RunState, incoming: string, done: (index: number | null) => void) {
	const layer = panel({
		title: 'Slots full',
		sub: `Drop one boost to take ${BOOSTS[incoming].name}.`,
		body: h(
			'div',
			{ class: 'cards' },
			run.boosts.map((b, i) =>
				boostCard(BOOSTS[b.id], b.level, {
					onClick: () => {
						sfx('click');
						pop(layer);
						done(i);
					},
				}),
			),
		),
		onBack: () => {
			pop(layer);
			done(null);
		},
	});
}

export function rewardPanel(
	run: RunState,
	p: { title: string; gold: number; offers: Offer[]; slot: boolean },
	actions: { take: (offer: Offer, replace?: number) => void; slot: () => void; skip: () => void },
) {
	const meta = game.save.meta;
	const cards = p.offers.map((offer) =>
		boostCard(BOOSTS[offer.id], offer.level, {
			upgrade: offer.upgrade,
			onClick: () => {
				sfx('click');
				if (needsReplace(run, meta, offer)) {
					replacePanel(run, offer.id, (i) => {
						if (i === null) return;
						pop(layer);
						actions.take(offer, i);
					});
					return;
				}
				pop(layer);
				actions.take(offer);
			},
		}),
	);
	if (p.slot)
		cards.push(
			plainCard('quiver', '+1 Boost slot', 'Carry one more boost for the rest of the run.', () => {
				sfx('coin');
				pop(layer);
				actions.slot();
			}),
		);
	const layer = panel({
		title: p.title,
		sub: p.gold > 0 ? `+${p.gold} gold. Pick one boost.` : 'Pick one.',
		body: h('div', { class: 'cards' }, cards),
		foot: [
			h('span', { class: 'spacer' }),
			button(
				'Skip (+12 gold)',
				() => {
					sfx('coin');
					pop(layer);
					actions.skip();
				},
				'btn--small',
			),
		],
	});
	return layer;
}

// ---------- Shop ----------

export function shopPanel(run: RunState, items: ShopItem[], actions: { buy: (item: ShopItem, index?: number) => void; leave: () => void }) {
	const meta = game.save.meta;
	let layer: Layer;
	const render = () => {
		if (layer) pop(layer);
		const cards = items.map((item) => {
			const ok = canBuy(run, meta, item);
			if (item.kind === 'boost' && item.offer) {
				const offer = item.offer;
				return boostCard(BOOSTS[offer.id], offer.level, {
					upgrade: offer.upgrade,
					price: item.price,
					disabled: !ok,
					picked: item.sold,
					onClick: () => {
						if (needsReplace(run, meta, offer)) {
							replacePanel(run, offer.id, (i) => {
								if (i === null) return;
								actions.buy(item, i);
								render();
							});
							return;
						}
						actions.buy(item);
						render();
					},
				});
			}
			if (item.kind === 'heal') return plainCard('heart', 'Bandages', `Heal ${SHOP.heal.amount}.`, () => (actions.buy(item), render()), item.price, !ok);
			if (item.kind === 'slot') return plainCard('quiver', 'Quiver strap', '+1 boost slot.', () => (actions.buy(item), render()), item.price, !ok || item.sold);
			return plainCard(
				'power',
				'Whetstone',
				'One boost goes up a level.',
				() =>
					pickBoost(run, 'Level up which boost?', upgradable(run), (i) => {
						actions.buy(item, i);
						render();
					}),
				item.price,
				!ok || item.sold,
			);
		});
		layer = panel({
			title: 'Shop',
			sub: `You have ${run.gold} gold and ${run.hp} health.`,
			body: h('div', { class: 'cards' }, cards),
			foot: [h('span', { class: 'spacer' }), button('Leave', () => (pop(layer), actions.leave()), 'btn--accent')],
			onBack: () => {
				pop(layer);
				actions.leave();
			},
		});
	};
	render();
}

/** Picks one of the given boost indexes. */
function pickBoost(run: RunState, title: string, indexes: number[], done: (i: number) => void) {
	const layer = panel({
		title,
		body: h(
			'div',
			{ class: 'cards' },
			indexes.map((i) => {
				const b = run.boosts[i];
				return boostCard(BOOSTS[b.id], b.level + 1, {
					upgrade: true,
					onClick: () => {
						sfx('click');
						pop(layer);
						done(i);
					},
				});
			}),
		),
		onBack: () => pop(layer),
	});
}

// ---------- Rest ----------

export function restPanel(run: RunState, actions: { heal: () => void; train: (i: number) => void }) {
	const meta = game.save.meta;
	const max = runStats(run, meta).maxHp;
	const list = upgradable(run);
	const layer = panel({
		title: 'Campfire',
		sub: `Health ${run.hp} / ${max}. Choose one.`,
		narrow: false,
		body: h(
			'div',
			{ class: 'cards' },
			plainCard('rest', 'Rest', `Heal ${restHealAmount(run, meta)} health.`, () => {
				pop(layer);
				actions.heal();
			}),
			plainCard(
				'power',
				'Train',
				list.length ? 'Raise one boost by a level.' : 'No boost can grow yet.',
				list.length
					? () =>
							pickBoost(run, 'Train which boost?', list, (i) => {
								pop(layer);
								actions.train(i);
							})
					: null,
			),
		),
	});
}

// ---------- Events ----------

export function eventPanel(run: RunState, id: string, actions: { choose: (i: number) => void }) {
	const ev = EVENTS[id];
	const layer = panel({
		title: ev.title,
		body: [
			h('p', { class: 'text' }, ev.text),
			h(
				'div',
				{ class: 'stack' },
				ev.choices.map((c, i) =>
					button(
						c.label,
						() => {
							sfx('click');
							pop(layer);
							actions.choose(i);
						},
						'choice',
						{ disabled: !choiceOpen(run, c) },
					),
				),
			),
		],
	});
}

export function eventResultPanel(id: string, result: string, onContinue: () => void) {
	const layer = panel({
		title: EVENTS[id].title,
		narrow: true,
		body: h('p', { class: 'result' }, result),
		foot: [h('span', { class: 'spacer' }), button('Continue', () => (pop(layer), onContinue()), 'btn--accent')],
	});
}

// ---------- Build view ----------

export function buildPanel(run: RunState) {
	const meta = game.save.meta;
	const stats = runStats(run, meta);
	const layer = panel({
		title: 'Your boosts',
		sub: `${run.boosts.length} of ${stats.slots} slots. Bow: ${BOWS[run.bow].name}.`,
		body: run.boosts.length ? h('div', { class: 'cards' }, run.boosts.map((b) => boostCard(BOOSTS[b.id], b.level))) : h('p', { class: 'text' }, 'No boosts yet. Win a fight to pick one.'),
		onBack: () => pop(layer),
	});
}

// ---------- Settings ----------

export function settingsPanel(onClose: () => void, onReplayTutorial?: () => void) {
	const s = game.save.settings;
	const save = () => {
		persist();
		applySettings();
	};
	const slider = (label: string, key: 'sfx' | 'music') => {
		const out = h('span', {}, `${Math.round(s[key] * 100)}`);
		const input = h('input', {
			type: 'range',
			min: 0,
			max: 100,
			value: Math.round(s[key] * 100),
			'aria-label': label,
			oninput: (e: Event) => {
				s[key] = Number((e.target as HTMLInputElement).value) / 100;
				out.textContent = `${Math.round(s[key] * 100)}`;
				save();
			},
			onchange: () => sfx('click'),
		});
		return h('label', { class: 'setting' }, label, input, out);
	};
	const toggle = (label: string, get: () => string, next: () => void, pressed: () => boolean) => {
		const btn = button(get(), () => {
			next();
			btn.textContent = get();
			btn.setAttribute('aria-pressed', String(pressed()));
			save();
			sfx('click');
		}, 'btn--small toggle', { 'aria-pressed': String(pressed()) });
		return h('div', { class: 'setting' }, label, h('span', {}), btn);
	};
	const shakeNames: Record<string, string> = { '0': 'Off', '0.5': 'Low', '1': 'Full' };
	const layer = panel({
		title: 'Settings',
		narrow: true,
		body: h(
			'div',
			{},
			slider('Sound', 'sfx'),
			slider('Music', 'music'),
			toggle('Screen shake', () => shakeNames[String(s.shake)] ?? 'Full', () => (s.shake = s.shake >= 1 ? 0 : s.shake === 0 ? 0.5 : 1), () => s.shake > 0),
			toggle('Hit stop', () => (s.hitStop ? 'On' : 'Off'), () => (s.hitStop = !s.hitStop), () => s.hitStop),
			toggle('Vibration', () => (s.haptics ? 'On' : 'Off'), () => (s.haptics = !s.haptics), () => s.haptics),
			toggle('Aim arc', () => (s.arc ? 'On' : 'Off'), () => (s.arc = !s.arc), () => s.arc),
		),
		foot: [
			onReplayTutorial
				? button('Replay tutorial', () => {
						game.save.meta.tutorialDone = false;
						persist();
						sfx('click');
						onReplayTutorial();
					}, 'btn--small')
				: null,
			button('Erase save', () => confirmPanel('Erase everything?', 'Feathers, upgrades, best score and the run in progress. This cannot be undone.', 'Erase', () => {
				eraseSave();
				location.reload();
			}), 'btn--small'),
			h('span', { class: 'spacer' }),
			button('Done', () => (pop(layer), onClose()), 'btn--accent'),
		],
		onBack: () => {
			pop(layer);
			onClose();
		},
	});
}

export function confirmPanel(title: string, text: string, yes: string, onYes: () => void) {
	const layer = panel({
		title,
		narrow: true,
		body: h('p', { class: 'text' }, text),
		foot: [h('span', { class: 'spacer' }), button('Cancel', () => pop(layer), 'btn--small'), button(yes, () => (pop(layer), onYes()), 'btn--accent btn--small')],
		onBack: () => pop(layer),
	});
}

// ---------- How to play ----------

export function howToPanel(onClose: () => void) {
	const row = (ico: string, title: string, text: string) =>
		h('div', { class: 'card', style: 'cursor:default' }, h('div', { class: 'card__top' }, h('div', { class: 'card__icon' }, icon(ico, 24)), h('h3', { class: 'card__name' }, title)), h('p', { class: 'card__text' }, text));
	const layer = panel({
		title: 'How to play',
		body: h(
			'div',
			{ class: 'cards' },
			row('bow', 'Shoot', 'Drag back anywhere, aim the arc, let go. Keys: arrows aim, hold Space and let go. Pad: left stick, hold A.'),
			row('target', 'Hit zones', 'A head shot kills. A body shot takes two. Knock helmets and plates off first.'),
			row('crown', 'Combo', 'Kill streaks fill the meter; a miss resets the streak. Full meter: Arrow Rain. Built on head shots: Crown Shot.'),
			row('fight', 'Foes', 'Flyers: aim high. Shields: lob over. Throwers: shoot the rocks down. Splitters burst in two.'),
			row('boss', 'Bosses', 'Each has a glowing weak spot. Hit it during a wind-up to break the attack.'),
			row('quiver', 'Boosts', 'Pick one after each fight. Slots are few: a new boost can replace an old one. Mix them into a build.'),
		),
		foot: [h('span', { class: 'spacer' }), button('Got it', () => (pop(layer), onClose()), 'btn--accent')],
		onBack: () => {
			pop(layer);
			onClose();
		},
	});
}

// ---------- Upgrade tree ----------

export function upgradesPanel(onClose: () => void) {
	const meta = game.save.meta;
	let layer: Layer;
	const render = () => {
		if (layer) pop(layer);
		const branches = (Object.keys(BRANCH_NAMES) as Branch[]).map((branch) => {
			const nodes = Object.values(UPGRADES)
				.filter((u) => u.branch === branch)
				.sort((a, b) => a.tier - b.tier);
			return h(
				'div',
				{ class: 'branch' },
				h('div', { class: 'branch__name' }, BRANCH_NAMES[branch]),
				nodes.map((u) => {
					const state = buyState(meta, u.id);
					const rank = rankOf(meta, u.id);
					const cost = nextCost(meta, u.id);
					const pips = h('span', { class: 'pips' });
					for (let i = 0; i < u.cost.length; i++) pips.append(h('span', { class: `pip${i < rank ? ' pip--on' : ''}` }));
					const needs = state === 'locked' ? `Needs ${u.requires.map((r) => UPGRADES[r].name).join(' + ')}` : '';
					return h(
						'button',
						{
							class: `card node${state === 'owned' ? ' node--owned' : ''}${state === 'locked' ? ' node--locked' : ''}`,
							type: 'button',
							disabled: state !== 'buy',
							onclick: () => {
								if (buy(meta, u.id)) {
									persist();
									sfx('coin');
									render();
								}
							},
						},
						h('h3', { class: 'card__name' }, u.name),
						u.cost.length > 1 ? pips : null,
						h('p', { class: 'card__text' }, needs || u.text),
						cost !== null ? h('span', { class: 'card__price' }, icon('feather', 14), String(cost)) : h('span', { class: 'tag' }, 'Owned'),
					);
				}),
			);
		});
		layer = panel({
			title: 'Upgrades',
			sub: `${meta.feathers} ${META.currency}. Earned at the end of every run.`,
			body: h('div', { class: 'tree' }, branches),
			foot: [h('span', { class: 'spacer' }), button('Done', () => (pop(layer), onClose()), 'btn--accent')],
			onBack: () => {
				pop(layer);
				onClose();
			},
		});
	};
	render();
}

// ---------- Bow pick ----------

export function bowPanel(onPick: (bow: string) => void, onBack: () => void) {
	const open = unlocks(game.save.meta);
	const layer = panel({
		title: 'Choose a bow',
		body: h(
			'div',
			{ class: 'cards' },
			Object.values(BOWS).map((b) => {
				const ok = !b.locked || open.has(`bow:${b.id}`);
				return plainCard('bow', b.name, ok ? b.blurb : 'Locked. Unlock it in the upgrade tree.', ok ? () => (pop(layer), onPick(b.id)) : null);
			}),
		),
		onBack: () => {
			pop(layer);
			onBack();
		},
	});
}

// ---------- End of run ----------

export function summaryPanel(run: RunState, best: boolean, actions: { upgrades: () => void; again: () => void; title: () => void }) {
	const t = run.tally;
	const won = run.result === 'won';
	const acc = t.shots ? Math.round((Math.min(t.hits, t.shots) / t.shots) * 100) : 0;
	const stat = (v: string | number, key: string) => h('div', { class: 'stat' }, h('span', { class: 'stat__v' }, String(v)), h('span', { class: 'stat__k' }, key));
	const layer = panel({
		title: won ? 'The last light holds' : 'Fallen',
		sub: won ? 'All three lands are free. The evening is yours.' : `Act ${run.act + 1}. The sun went down without you.`,
		body: [
			h('div', { class: 'score' }, h('span', { class: 'score__v' }, run.score.toLocaleString('en')), best ? h('span', { class: 'tag tag--accent' }, 'New best') : h('span', { class: 'tag' }, `Best ${game.save.meta.best?.score.toLocaleString('en') ?? 0}`), h('span', { class: 'tag' }, `+${run.feathers} ${META.currency}`)),
			h(
				'div',
				{ class: 'stats' },
				stat(t.kills, 'Kills'),
				stat(t.headshots, 'Head shots'),
				stat(`${acc}%`, 'Accuracy'),
				stat(t.maxStreak, 'Best streak'),
				stat(t.bosses, 'Bosses'),
				stat(t.spots, 'Spots'),
				stat(t.bonusShots, 'Bonus shots'),
				stat(`${Math.floor(t.time / 60)}:${String(Math.floor(t.time % 60)).padStart(2, '0')}`, 'Fight time'),
			),
		],
		foot: [
			button('Title', () => (pop(layer), actions.title()), 'btn--small'),
			h('span', { class: 'spacer' }),
			button(h('span', { class: 'row', style: 'gap:6px;align-items:center' }, icon('feather', 16), 'Upgrades'), () => (pop(layer), actions.upgrades())),
			button('New run', () => (pop(layer), actions.again()), 'btn--accent'),
		],
	});
}

