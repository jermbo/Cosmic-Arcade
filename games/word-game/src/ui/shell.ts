// The frame of a game screen: header with back, title, score, hearts, help and Kip.
import { buzz, sfx } from '../audio.ts';
import { TUNING } from '../core/tuning.ts';
import { h, icon } from './dom.ts';
import { countUp, pulse } from './fx.ts';
import { Kip } from './kip.ts';

export class Hearts {
	el: HTMLElement;
	left: number;
	private icons: HTMLElement[] = [];

	max: number;

	constructor(max: number) {
		this.max = max;
		this.left = max;
		this.el = h('div', { class: 'hearts', role: 'img', 'aria-label': `${max} hearts left` });
		for (let i = 0; i < max; i++) this.icons.push(this.el.appendChild(icon('heart', 'heart')));
	}

	lose(): void {
		if (this.left <= 0) return;
		this.left--;
		const el = this.icons[this.left];
		el.classList.add('heart--lost');
		pulse(el, 'heart--break');
		pulse(this.el, 'hearts--hit');
		sfx.heart();
		buzz(60);
		this.el.setAttribute('aria-label', `${this.left} hearts left`);
	}
}

export interface ShellOpts {
	title: string;
	tag: string;
	hearts: number;
	onBack: () => void;
	onHelp: () => void;
	/** Points are multiplied by this (harder games score more). */
	scale: number;
	/** Hints Kip can give this game. */
	hints: number;
	/** Gives one hint and returns what Kip says, or null when there is nothing to hint. */
	onHint: () => string | null;
}

export class Shell {
	el: HTMLElement;
	main: HTMLElement;
	hearts: Hearts;
	kip = new Kip('small');
	private scoreEl: HTMLElement;
	score = 0;
	private scale: number;
	private hintsLeft: number;
	hintsUsed = 0;
	private kipBtn: HTMLButtonElement;
	private badge: HTMLElement;
	private bubble: HTMLElement;
	private bubbleTimer = 0;
	/** Set to false to stop hints (game over, a modal is open). */
	hintsOn = true;

	constructor(opts: ShellOpts) {
		this.scale = opts.scale;
		this.hintsLeft = opts.hints;
		this.badge = h('span', { class: 'kipbtn__badge' }, String(opts.hints));
		this.bubble = h('span', { class: 'bubble', role: 'status', 'aria-live': 'polite' });
		this.kipBtn = h('button', { class: 'kipbtn', type: 'button', on: { click: () => this.askKip(opts.onHint) } }, this.kip.el, this.badge, this.bubble);
		this.syncKip();
		this.hearts = new Hearts(opts.hearts);
		this.scoreEl = h('span', { class: 'hud__score-num' }, '0');
		const back = h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Back to menu', on: { click: opts.onBack } }, icon('back'));
		const help = h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'How to play', on: { click: opts.onHelp } }, icon('help'));
		const header = h(
			'header',
			{ class: 'hud' },
			back,
			h('div', { class: 'hud__title' }, h('strong', {}, opts.title), h('span', { class: 'hud__tag' }, opts.tag)),
			this.kipBtn,
			h('div', { class: 'hud__stats' }, h('span', { class: 'hud__score', 'aria-label': 'Score' }, this.scoreEl), this.hearts.el),
			help,
		);
		this.main = h('main', { class: 'game__main' });
		this.el = h('div', { class: 'screen game' }, header, this.main);
	}

	addScore(points: number): void {
		points = Math.round(points * this.scale);
		if (points <= 0) return;
		const from = this.score;
		this.score += points;
		countUp(this.scoreEl, from, this.score, 600);
		pulse(this.scoreEl.parentElement!, 'hud__score--bump');
		const float = h('span', { class: 'float' }, `+${points}`);
		this.scoreEl.parentElement!.append(float);
		setTimeout(() => float.remove(), 1000);
	}

	private syncKip() {
		this.badge.textContent = String(this.hintsLeft);
		this.kipBtn.classList.toggle('kipbtn--empty', this.hintsLeft <= 0);
		this.kipBtn.setAttribute('aria-label', `Ask Kip for a hint. ${this.hintsLeft} left.`);
	}

	say(text: string, ms = 2400): void {
		this.bubble.textContent = text;
		this.bubble.classList.remove('bubble--show');
		void this.bubble.offsetWidth;
		this.bubble.classList.add('bubble--show');
		clearTimeout(this.bubbleTimer);
		this.bubbleTimer = window.setTimeout(() => this.bubble.classList.remove('bubble--show'), ms);
	}

	private askKip(onHint: () => string | null) {
		if (!this.hintsOn) return;
		if (this.hintsLeft <= 0) {
			sfx.invalid();
			this.kip.react('oops', 700);
			this.say("I'm all out of tips!");
			return;
		}
		const text = onHint();
		if (!text) {
			sfx.ui();
			this.kip.react('think', 900);
			this.say('Hmm… nothing to hint here.');
			return;
		}
		this.hintsLeft--;
		this.hintsUsed++;
		this.syncKip();
		pulse(this.badge, 'diff__btn--pop');
		this.spend(TUNING.hintCost);
		this.kip.react('happy', 900);
		sfx.letter();
		this.say(text);
	}

	/** Takes points away (never below 0). */
	spend(points: number): void {
		points = Math.min(this.score, Math.round(points * this.scale));
		if (points <= 0) return;
		const from = this.score;
		this.score -= points;
		countUp(this.scoreEl, from, this.score, 400);
		const float = h('span', { class: 'float float--minus' }, `−${points}`);
		this.scoreEl.parentElement!.append(float);
		setTimeout(() => float.remove(), 1000);
	}

	destroy(): void {
		clearTimeout(this.bubbleTimer);
		this.kip.destroy();
	}
}
