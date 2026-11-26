// The frame of a game screen: header with back, title, score, hearts, help and Kip.
import { buzz, sfx } from '../audio.ts';
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
}

export class Shell {
	el: HTMLElement;
	main: HTMLElement;
	hearts: Hearts;
	kip = new Kip('small');
	private scoreEl: HTMLElement;
	score = 0;
	private scale: number;

	constructor(opts: ShellOpts) {
		this.scale = opts.scale;
		this.hearts = new Hearts(opts.hearts);
		this.scoreEl = h('span', { class: 'hud__score-num' }, '0');
		const back = h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Back to menu', on: { click: opts.onBack } }, icon('back'));
		const help = h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'How to play', on: { click: opts.onHelp } }, icon('help'));
		const header = h(
			'header',
			{ class: 'hud' },
			back,
			h('div', { class: 'hud__title' }, h('strong', {}, opts.title), h('span', { class: 'hud__tag' }, opts.tag)),
			this.kip.el,
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

	destroy(): void {
		this.kip.destroy();
	}
}
