import { formatMoney, goalDone, goalText, goalValue, LEVELS } from './levels/index.ts';
import type { RunStats } from './levels/index.ts';
import type { GoalDef, LevelDef } from './levels/types.ts';
import type { Device } from './input.ts';
import type { SaveData } from './save.ts';

/** The menus and the HUD. They are plain HTML on top of the game view. */

export type ScreenId = 'none' | 'title' | 'select' | 'pause' | 'settings' | 'results' | 'tutorial';

export interface UiHandlers {
	play(level: number): void;
	watch(level: number): void;
	continueGame(): void;
	retry(): void;
	next(): void;
	resume(): void;
	pause(): void;
	toTitle(): void;
	toSelect(): void;
	launch(): void;
	breaker(): void;
	settingsChanged(): void;
	eraseSave(): void;
	tutorialClosed(): void;
	sound(kind: 'move' | 'select' | 'back'): void;
}

export interface HudState {
	money: number;
	multiplier: number;
	chain: number;
	chainLeft: number;
	meter: number;
	meterLive: boolean;
	timeLeft: number;
	prompt: string;
	settle: number;
	showLaunch: boolean;
	showBreaker: boolean;
	breakerHint: string;
	stats: RunStats;
}

export interface ResultsData {
	level: LevelDef;
	index: number;
	stats: RunStats;
	best: number;
	newBest: boolean;
	/** One flag for each goal: reached for the first time in this run. */
	newGoals: boolean[];
	/** One flag for each goal: reached in this run or before. */
	doneGoals: boolean[];
	nextOpen: boolean;
	hasReplay: boolean;
	wasReplay: boolean;
}

interface TutorialPage {
	title: string;
	text: string;
	keys: Record<Device, [string, string][]>;
}

const TUTORIAL: TutorialPage[] = [
	{
		title: 'Aim and launch',
		text: 'You get one car and one try. Watch the traffic, pick your line and launch into the junction. You can still steer a little on the way in.',
		keys: {
			keyboard: [['← → or mouse', 'Aim, then steer'], ['Space or click', 'Launch']],
			gamepad: [['Left stick', 'Aim, then steer'], ['A', 'Launch']],
			touch: [['Drag', 'Aim, then steer'], ['Launch button', 'Launch']],
		},
	},
	{
		title: 'Aftertouch',
		text: 'After the first hit, time slows down while you push your wreck around. Push it into the path of more traffic. The meter is short and it does not refill.',
		keys: {
			keyboard: [['Arrows or W A S D', 'Push the wreck']],
			gamepad: [['Left stick', 'Push the wreck']],
			touch: [['Drag anywhere', 'Push the wreck']],
		},
	},
	{
		title: 'Crashbreaker',
		text: 'Once in each run you can blow up your own car. The blast throws and wrecks everything near it. Save it for the moment when the most vehicles are close.',
		keys: {
			keyboard: [['Space', 'Crashbreaker'], ['R', 'Retry fast'], ['Esc', 'Pause']],
			gamepad: [['A', 'Crashbreaker'], ['Y', 'Retry fast'], ['Start', 'Pause']],
			touch: [['Red button', 'Crashbreaker'], ['II', 'Pause and retry']],
		},
	},
	{
		title: 'Chains and bonus',
		text: 'Each wreck pays money. Wrecks in quick succession raise the multiplier, and it resets when the chain breaks. Buses and tankers pay the most. Tankers and red barrels explode.',
		keys: { keyboard: [], gamepad: [], touch: [] },
	},
];

function byId<T extends HTMLElement>(id: string): T {
	const element = document.getElementById(id);
	if (!element) throw new Error(`The page has no element "${id}".`);
	return element as T;
}

export class Ui {
	screen: ScreenId = 'none';
	private handlers: UiHandlers;
	private save: SaveData;
	private screens: Record<Exclude<ScreenId, 'none'>, HTMLElement>;
	private hud = byId('hud');
	private settingsReturn: ScreenId = 'title';
	private tutorialPage = 0;
	private device: Device = 'keyboard';
	private shown = { money: -1, moneyValue: 0, mult: 0, time: -1, prompt: '', goals: '', breakerHint: '' };
	private money = byId('hud-money');
	private mult = byId('hud-mult');
	private chain = byId('hud-chain');
	private chainLabel = byId('hud-chain-label');
	private chainFill = byId('hud-chain-fill');
	private meter = byId('hud-meter');
	private meterFill = byId('hud-meter-fill');
	private time = byId('hud-time');
	private prompt = byId('hud-prompt');
	private settle = byId('hud-settle');
	private settleFill = byId('hud-settle-fill');
	private launchButton = byId<HTMLButtonElement>('hud-launch');
	private breakerButton = byId<HTMLButtonElement>('hud-breaker');
	private goals = byId('hud-goals');
	private pops = byId('hud-pops');
	private banner = byId('hud-banner');
	private hudLevel: LevelDef | undefined;

	constructor(handlers: UiHandlers, save: SaveData) {
		this.handlers = handlers;
		this.save = save;
		this.screens = {
			title: byId('screen-title'),
			select: byId('screen-select'),
			pause: byId('screen-pause'),
			settings: byId('screen-settings'),
			results: byId('screen-results'),
			tutorial: byId('screen-tutorial'),
		};

		const click = (id: string, action: () => void, sound: 'select' | 'back' = 'select'): void => {
			byId(id).addEventListener('click', () => {
				this.handlers.sound(sound);
				action();
			});
		};
		click('title-play', () => handlers.continueGame());
		click('title-select', () => handlers.toSelect());
		click('title-help', () => this.openTutorial());
		click('title-settings', () => this.openSettings());
		click('select-back', () => handlers.toTitle(), 'back');
		click('pause-resume', () => handlers.resume());
		click('pause-retry', () => handlers.retry());
		click('pause-settings', () => this.openSettings());
		click('pause-select', () => handlers.toSelect());
		click('set-back', () => this.show(this.settingsReturn), 'back');
		click('set-reset', () => {
			if (window.confirm('Erase all saved scores and replays?')) handlers.eraseSave();
		});
		click('results-retry', () => handlers.retry());
		click('results-next', () => handlers.next());
		click('results-select', () => handlers.toSelect());
		click('tutorial-next', () => this.turnTutorial());
		click('tutorial-skip', () => this.closeTutorial(), 'back');
		byId('hud-pause').addEventListener('click', () => handlers.pause());
		this.launchButton.addEventListener('click', () => handlers.launch());
		this.breakerButton.addEventListener('click', () => handlers.breaker());

		for (const key of ['master', 'sfx', 'music', 'shake'] as const) {
			const input = byId<HTMLInputElement>(`set-${key}`);
			input.addEventListener('input', () => {
				this.save.settings[key] = Number(input.value) / 100;
				handlers.settingsChanged();
			});
		}

		if (location.pathname.includes('/games/')) {
			byId('title-note').innerHTML = '<a href="../">Back to the arcade</a>';
		}
	}

	setSave(save: SaveData): void {
		this.save = save;
	}

	setDevice(device: Device): void {
		this.device = device;
	}

	show(screen: ScreenId): void {
		this.screen = screen;
		for (const [id, element] of Object.entries(this.screens)) element.hidden = id !== screen;
		if (screen === 'settings') {
			for (const key of ['master', 'sfx', 'music', 'shake'] as const) {
				byId<HTMLInputElement>(`set-${key}`).value = String(Math.round(this.save.settings[key] * 100));
			}
		}
		if (screen !== 'none') this.focusFirst();
		else if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
	}

	openSettings(): void {
		this.settingsReturn = this.screen;
		this.show('settings');
	}

	openTutorial(): void {
		this.settingsReturn = this.screen;
		this.tutorialPage = 0;
		this.fillTutorial();
		this.show('tutorial');
	}

	/** Moves the focus between the buttons of the open screen. */
	move(direction: 'up' | 'down' | 'left' | 'right'): void {
		if (this.screen === 'none') return;
		const items = this.focusable();
		if (items.length === 0) return;
		const current = document.activeElement as HTMLElement;
		const index = items.indexOf(current);
		if (current instanceof HTMLInputElement && (direction === 'left' || direction === 'right')) {
			const step = Number(current.step) || 1;
			current.value = String(Number(current.value) + (direction === 'left' ? -step : step));
			current.dispatchEvent(new Event('input'));
			return;
		}
		if (index === -1) {
			items[0].focus();
			return;
		}
		const from = current.getBoundingClientRect();
		const cx = from.left + from.width / 2;
		const cy = from.top + from.height / 2;
		let best: HTMLElement | undefined;
		let bestScore = Infinity;
		for (const item of items) {
			if (item === current) continue;
			const box = item.getBoundingClientRect();
			const dx = box.left + box.width / 2 - cx;
			const dy = box.top + box.height / 2 - cy;
			const along = direction === 'up' ? -dy : direction === 'down' ? dy : direction === 'left' ? -dx : dx;
			const across = direction === 'up' || direction === 'down' ? Math.abs(dx) : Math.abs(dy);
			if (along < 4) continue;
			const score = along + across * 2.5;
			if (score < bestScore) {
				bestScore = score;
				best = item;
			}
		}
		if (best) {
			best.focus();
			best.scrollIntoView({ block: 'nearest' });
			this.handlers.sound('move');
		}
	}

	/** Presses the button that has the focus. For the gamepad. */
	confirm(): void {
		if (this.screen === 'none') return;
		const current = document.activeElement;
		if (current instanceof HTMLButtonElement && !current.disabled) current.click();
	}

	/** The "back" action of the open screen. */
	back(): void {
		switch (this.screen) {
			case 'select':
				this.handlers.sound('back');
				this.handlers.toTitle();
				break;
			case 'pause':
				this.handlers.resume();
				break;
			case 'settings':
				this.handlers.sound('back');
				this.show(this.settingsReturn);
				break;
			case 'tutorial':
				this.closeTutorial();
				break;
			case 'results':
				this.handlers.toSelect();
				break;
		}
	}

	buildSelect(unlocked: number): void {
		const list = byId('select-cards');
		list.replaceChildren();
		LEVELS.forEach((level, index) => {
			const data = this.save.levels[level.id];
			const open = index < unlocked;
			const item = document.createElement('li');
			item.className = open ? 'card' : 'card card--locked';
			const done = level.goals.map((_, i) => data?.goals[i] === true);
			const pips = done.map((d) => (d ? '●' : '○')).join('');
			const facts = !open
				? 'Reach one goal in the junction before to open this one.'
				: data && data.best > 0
					? `Best <strong>${formatMoney(data.best)}</strong> · chain <strong>${data.bestChain}</strong>`
					: level.hint;
			item.innerHTML = `
				<div class="card__top">
					<span class="card__number">${index + 1}</span>
					<span class="card__name">${level.name}</span>
					<span class="card__pips" aria-label="${done.filter(Boolean).length} of ${done.length} goals">${pips}</span>
				</div>
				<p class="card__facts">${facts}</p>
				<div class="card__buttons"></div>`;
			const buttons = item.querySelector('.card__buttons') as HTMLElement;
			const play = document.createElement('button');
			play.type = 'button';
			play.className = 'button button--small button--main';
			play.textContent = open ? 'Play' : 'Locked';
			play.disabled = !open;
			play.addEventListener('click', () => {
				this.handlers.sound('select');
				this.handlers.play(index);
			});
			buttons.append(play);
			if (open && data?.replay) {
				const watch = document.createElement('button');
				watch.type = 'button';
				watch.className = 'button button--small';
				watch.textContent = 'Replay';
				watch.addEventListener('click', () => {
					this.handlers.sound('select');
					this.handlers.watch(index);
				});
				buttons.append(watch);
			}
			list.append(item);
		});
	}

	showResults(data: ResultsData): void {
		byId('results-tape').textContent = data.wasReplay ? 'Replay' : `Crash report no. ${String(data.index + 1).padStart(3, '0')}`;
		byId('results-level').textContent = data.level.name;
		byId('results-money').textContent = formatMoney(data.stats.money);
		const best = byId('results-best');
		best.textContent = data.newBest ? 'New best score!' : `Your best: ${formatMoney(data.best)}`;
		best.classList.toggle('report__best--new', data.newBest);
		byId('results-chain').textContent = String(data.stats.bestChain);
		byId('results-wrecks').textContent = String(data.stats.wrecks);
		byId('results-bonus').textContent = String(data.stats.bonus.bus + data.stats.bonus.tanker + data.stats.bonus.barrel);
		this.fillGoals(byId('results-goals'), data.level.goals, data.stats, data.doneGoals, data.newGoals);

		const next = byId<HTMLButtonElement>('results-next');
		next.hidden = data.index >= LEVELS.length - 1;
		next.disabled = !data.nextOpen;
		next.textContent = data.nextOpen ? 'Next junction' : 'Next: reach a goal';
		const replay = byId<HTMLButtonElement>('results-replay');
		replay.hidden = !data.hasReplay;
		replay.onclick = () => {
			this.handlers.sound('select');
			this.handlers.watch(data.index);
		};
		this.show('results');
		if (data.nextOpen && data.newGoals.some(Boolean) && !next.hidden) next.focus();
	}

	setHud(visible: boolean, level?: LevelDef, replay = false): void {
		this.hud.hidden = !visible;
		byId('hud-replay').hidden = !replay;
		if (level) {
			this.hudLevel = level;
			byId('hud-level').textContent = level.name;
			this.shown.goals = '';
			this.shown.money = -1;
			this.shown.moneyValue = 0;
			this.pops.replaceChildren();
			this.banner.hidden = true;
		}
	}

	updateHud(state: HudState, dt: number): void {
		const shown = this.shown;
		// The money counts up fast to the real value.
		shown.moneyValue += (state.money - shown.moneyValue) * Math.min(1, dt * 12);
		if (Math.abs(state.money - shown.moneyValue) < 10) shown.moneyValue = state.money;
		const money = Math.round(shown.moneyValue / 10) * 10;
		if (money !== shown.money) {
			shown.money = money;
			this.money.textContent = formatMoney(money);
		}

		if (state.multiplier !== shown.mult) {
			if (state.multiplier > shown.mult) restart(this.mult, 'hud__mult--bump');
			shown.mult = state.multiplier;
			this.mult.textContent = `×${state.multiplier}`;
			this.mult.style.setProperty('--grow', String(1 + Math.min(11, state.multiplier - 1) * 0.07));
		}
		this.chain.dataset.on = String(state.chain > 0);
		this.chainLabel.textContent = state.chain > 0 ? `chain ${state.chain}` : 'chain';
		this.chainFill.style.transform = `scaleX(${Math.max(0, Math.min(1, state.chainLeft))})`;

		this.meterFill.style.transform = `scaleX(${Math.max(0, Math.min(1, state.meter))})`;
		this.meter.classList.toggle('hud__meter--live', state.meterLive);
		this.meter.classList.toggle('hud__meter--empty', state.meter <= 0);

		const seconds = Math.max(0, Math.ceil(state.timeLeft));
		if (seconds !== shown.time) {
			shown.time = seconds;
			this.time.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
			this.time.classList.toggle('hud__time--low', seconds <= 5);
		}
		if (state.prompt !== shown.prompt) {
			shown.prompt = state.prompt;
			this.prompt.textContent = state.prompt;
		}
		this.settle.hidden = state.settle < 0;
		if (state.settle >= 0) this.settleFill.style.transform = `scaleX(${state.settle})`;
		this.launchButton.hidden = !state.showLaunch;
		this.breakerButton.hidden = !state.showBreaker;
		if (state.breakerHint !== shown.breakerHint) {
			shown.breakerHint = state.breakerHint;
			this.breakerButton.innerHTML = `Crashbreaker<small>${state.breakerHint}</small>`;
		}

		if (this.hudLevel) {
			const key = this.hudLevel.goals.map((goal) => (goalDone(goal, state.stats) ? '1' : '0')).join('');
			if (key !== shown.goals) {
				shown.goals = key;
				const done = this.hudLevel.goals.map((goal) => goalDone(goal, state.stats));
				this.fillGoals(this.goals, this.hudLevel.goals, state.stats, done, done.map(() => false));
			}
		}
	}

	/** Shows money at a place of the screen, for a hit. */
	pop(x: number, y: number, text: string, detail: string, kind: 'hit' | 'bonus' | 'blast'): void {
		if (this.pops.childElementCount > 24) this.pops.firstElementChild?.remove();
		const element = document.createElement('p');
		element.className = kind === 'hit' ? 'pop' : `pop pop--${kind}`;
		element.style.left = `${x}px`;
		element.style.top = `${y}px`;
		element.textContent = text;
		if (detail) {
			const small = document.createElement('small');
			small.textContent = detail;
			element.append(small);
		}
		element.addEventListener('animationend', () => element.remove());
		this.pops.append(element);
	}

	/** Shows a large word in the middle of the screen for a moment. */
	flash(text: string): void {
		this.banner.textContent = text;
		this.banner.hidden = false;
		restart(this.banner, 'hud__banner');
	}

	private fillGoals(list: HTMLElement, goals: GoalDef[], stats: RunStats, done: boolean[], fresh: boolean[]): void {
		list.replaceChildren();
		goals.forEach((goal, i) => {
			const item = document.createElement('li');
			item.className = 'goal' + (done[i] ? ' goal--done' : '') + (fresh[i] ? ' goal--new' : '');
			const value = goalValue(goal, stats);
			const text = document.createElement('span');
			text.textContent = goalText(goal) + (fresh[i] ? ' (new)' : '');
			const count = document.createElement('span');
			count.className = 'goal__value';
			count.textContent = goal.kind === 'money' ? formatMoney(value) : `${value} / ${goal.target}`;
			item.append(text, count);
			list.append(item);
		});
	}

	private fillTutorial(): void {
		const page = TUTORIAL[this.tutorialPage];
		byId('tutorial-count').textContent = `${this.tutorialPage + 1} of ${TUTORIAL.length}`;
		byId('tutorial-title').textContent = page.title;
		byId('tutorial-text').textContent = page.text;
		const keys = byId('tutorial-keys');
		keys.replaceChildren();
		for (const [key, what] of page.keys[this.device]) {
			const dt = document.createElement('dt');
			dt.textContent = key;
			const dd = document.createElement('dd');
			dd.textContent = what;
			keys.append(dt, dd);
		}
		byId('tutorial-next').textContent = this.tutorialPage === TUTORIAL.length - 1 ? 'Got it' : 'Next';
	}

	private turnTutorial(): void {
		if (this.tutorialPage >= TUTORIAL.length - 1) {
			this.closeTutorial();
			return;
		}
		this.tutorialPage++;
		this.fillTutorial();
	}

	private closeTutorial(): void {
		this.show(this.settingsReturn === 'tutorial' ? 'none' : this.settingsReturn);
		this.handlers.tutorialClosed();
	}

	private focusable(): HTMLElement[] {
		if (this.screen === 'none') return [];
		return Array.from(this.screens[this.screen].querySelectorAll<HTMLElement>('button:not(:disabled):not([hidden]), input'));
	}

	private focusFirst(): void {
		const first = this.focusable()[0];
		if (first) first.focus({ preventScroll: true });
	}
}

/** Starts a CSS animation of an element again. */
function restart(element: HTMLElement, name: string): void {
	element.classList.remove(name);
	void element.offsetWidth;
	element.classList.add(name);
}
