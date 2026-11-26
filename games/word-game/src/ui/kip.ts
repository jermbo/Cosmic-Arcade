// Kip, the tile buddy. A square letter tile with a face that reacts to play.
import { wornHat } from '../book.ts';
import { h } from './dom.ts';
import { hatSvg } from './hats.ts';

export type Mood = 'happy' | 'sad' | 'wow' | 'think' | 'oops';

const FACE = `
<svg viewBox="0 0 64 64" aria-hidden="true">
	<g class="kip__eyes">
		<g class="kip__eye kip__eye--l"><ellipse cx="22" cy="27" rx="6.5" ry="8" fill="#fff" stroke="#141414" stroke-width="3"/><circle class="kip__pupil" cx="23" cy="28" r="3.4" fill="#141414"/></g>
		<g class="kip__eye kip__eye--r"><ellipse cx="42" cy="27" rx="6.5" ry="8" fill="#fff" stroke="#141414" stroke-width="3"/><circle class="kip__pupil" cx="43" cy="28" r="3.4" fill="#141414"/></g>
	</g>
	<g class="kip__joy" fill="none" stroke="#141414" stroke-width="3.4" stroke-linecap="round"><path d="M16 29q6-8 12 0M36 29q6-8 12 0"/></g>
	<path class="kip__mouth kip__mouth--smile" d="M25 42q7 6 14 0" fill="none" stroke="#141414" stroke-width="3.4" stroke-linecap="round"/>
	<path class="kip__mouth kip__mouth--open" d="M25 41q7 10 14 0z" fill="#141414" stroke="#141414" stroke-width="3" stroke-linejoin="round"/>
	<path class="kip__mouth kip__mouth--sad" d="M25 46q7-6 14 0" fill="none" stroke="#141414" stroke-width="3.4" stroke-linecap="round"/>
	<circle class="kip__mouth kip__mouth--o" cx="32" cy="44" r="4" fill="#141414"/>
	<g class="kip__cheeks" fill="#FF8FB1"><ellipse cx="14" cy="38" rx="4" ry="2.6"/><ellipse cx="50" cy="38" rx="4" ry="2.6"/></g>
</svg>`;

export class Kip {
	el: HTMLElement;
	private timer = 0;
	private blinkTimer = 0;
	private hatEl: HTMLElement;

	/** Puts a hat on (or off, with null). */
	setHat(hat: string | null): void {
		this.hatEl.innerHTML = hat ? hatSvg(hat) : '';
		this.el.classList.toggle('kip--hatted', !!hat);
	}

	constructor(size: 'big' | 'small' = 'small') {
		this.el = h('div', { class: `kip kip--${size}`, 'aria-hidden': 'true', html: FACE });
		this.hatEl = this.el.appendChild(h('span', { class: 'kip__hat' }));
		this.setHat(wornHat()?.hat ?? null);
		this.blinkLoop();
	}

	private blinkLoop() {
		this.blinkTimer = window.setTimeout(() => {
			this.el.classList.add('kip--blink');
			setTimeout(() => this.el.classList.remove('kip--blink'), 140);
			this.blinkLoop();
		}, 2200 + Math.random() * 3200);
	}

	react(mood: Mood, ms = 1100): void {
		clearTimeout(this.timer);
		this.el.classList.remove('kip--happy', 'kip--sad', 'kip--wow', 'kip--think', 'kip--oops');
		void this.el.offsetWidth;
		this.el.classList.add(`kip--${mood}`);
		if (ms > 0) this.timer = window.setTimeout(() => this.el.classList.remove(`kip--${mood}`), ms);
	}

	/** Pupils look toward a point on the screen. */
	look(x: number, y: number): void {
		const r = this.el.getBoundingClientRect();
		const dx = Math.max(-1, Math.min(1, (x - (r.left + r.width / 2)) / 200));
		const dy = Math.max(-1, Math.min(1, (y - (r.top + r.height / 2)) / 200));
		this.el.style.setProperty('--lx', `${dx * 2.4}px`);
		this.el.style.setProperty('--ly', `${dy * 2.4}px`);
	}

	destroy(): void {
		clearTimeout(this.timer);
		clearTimeout(this.blinkTimer);
	}
}
