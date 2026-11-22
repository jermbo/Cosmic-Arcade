import { OFFERS, VENDOR_LINES } from '../../data/shop.ts';
import { leaveShop } from '../../rules/run.ts';
import { buyOffer, offerState, type OfferState } from '../../rules/shop.ts';
import type { App } from '../app.ts';
import { dur, floatText, gsap, shake } from '../fx.ts';

const BUTTON: Record<OfferState, string> = {
	buy: 'BUY',
	poor: 'NO CYCLES',
	bought: 'SOLD',
	owned: 'INSTALLED',
};

export function mountShop(app: App): void {
	const run = app.run!;
	const greet = VENDOR_LINES[(run.seed + run.floor) % VENDOR_LINES.length];

	app.stage.innerHTML = `
		<section class="shop">
			<header class="screen-head">
				<p class="eyebrow green">MARKET // UNLICENSED</p>
				<h1 class="screen-title">THE FENCE</h1>
			</header>
			<div class="vendor panel">
				<pre class="vendor__face" aria-hidden="true">
 ┌─────┐
 │ ▓ ▓ │
 │  ─  │
 └─┬─┬─┘</pre>
				<p class="vendor__line" data-line>&gt; ${greet}</p>
			</div>
			<div class="offers"></div>
			<div class="reward__actions"><button class="btn btn--ghost" type="button" data-act="leave">WALK AWAY</button></div>
		</section>`;

	const offersEl = app.stage.querySelector<HTMLElement>('.offers')!;
	const lineEl = app.stage.querySelector<HTMLElement>('[data-line]')!;

	const render = () => {
		offersEl.innerHTML = OFFERS.map((o) => {
			const st = offerState(run, o);
			return `
				<article class="offer panel offer--${st}" data-offer="${o.id}">
					<h2 class="offer__name">${o.name}</h2>
					<p class="offer__text">${o.text}</p>
					<p class="offer__pitch dim">"${o.pitch}"</p>
					<div class="offer__foot">
						<span class="gold offer__price">${o.price} CYC</span>
						<button class="btn ${st === 'buy' ? 'btn--buy' : ''}" type="button" data-buy="${o.id}" ${st === 'buy' ? '' : 'aria-disabled="true"'}>${BUTTON[st]}</button>
					</div>
				</article>`;
		}).join('');
	};
	render();
	gsap.from(offersEl.children, { y: 24, opacity: 0, duration: dur(0.35), stagger: dur(0.08), ease: 'power2.out', clearProps: 'transform,opacity' });

	offersEl.addEventListener('click', (e) => {
		const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-buy]');
		if (!btn) return;
		const offer = OFFERS.find((o) => o.id === btn.dataset.buy)!;
		const st = offerState(run, offer);
		if (st !== 'buy') {
			shake(btn, 4);
			lineEl.textContent = st === 'poor' ? '> COME BACK WITH CYCLES.' : '> ALREADY IN YOUR RIG.';
			return;
		}
		const traceBefore = run.trace;
		buyOffer(run, offer.id);
		floatText(app.hud.cyclesEl(), `−${offer.price}`, 'gold', 40);
		if (offer.id === 'vent' && traceBefore > 0) floatText(app.hud.traceEl(), 'TRACE 0', 'green', 40);
		app.log(`Bought ${offer.name}.`, 'gold');
		lineEl.textContent = '> DONE. FORGET MY FACE.';
		app.hud.update(run);
		render();
	});

	app.stage.querySelector('[data-act="leave"]')!.addEventListener('click', () => {
		leaveShop(run);
		app.log('Left the market.', 'sys');
		app.go('map');
	});
}
