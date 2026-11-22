// The planet card on the space map: a planet to open, or one to unlock.

import { sfx } from '../audio.ts';
import { MACHINES } from '../content/machines.ts';
import { PLANETS } from '../content/planets.ts';
import { fmt } from '../core/format.ts';
import { countOf } from '../core/machine-count.ts';
import { checkProgress } from '../core/progress.ts';
import { planetBadge } from '../core/blocks.ts';
import { tapValue } from '../core/hand-mining.ts';
import { unlockPlanet } from '../core/shop.ts';
import { saveGame } from '../core/save.ts';
import { openCrew } from './panels/crew.ts';
import { openShips } from './panels/ships.ts';
import { burst, ring } from '../view/fx.ts';
import { session } from '../session.ts';
import { ui } from './elements.ts';
import { toPlanet } from './screens.ts';
import { toastUnlock } from './toasts.ts';
import { buzz } from './vibrate.ts';
import { space } from '../views.ts';

export function updateCard() {
	const i = space.selected;
	if (session.view !== 'space' || i < 0 || !session.started) {
		ui.card.hidden = true;
		return;
	}
	const def = PLANETS[i];
	const p = session.g.planets[i];
	let html: string;
	if (p.unlocked) {
		const drills = countOf(session.g, i, 'drill');
		const rate = space.rate[i] / 12;
		const sub = rate > 0.05 ? `${fmt(rate)}/s` : drills ? 'Starting up' : 'No factory yet';
		const badge = planetBadge(session.g, i);
		const flag =
			badge === 'warn' ? ' ⚠ Stalled' : badge === 'full' ? ' 📦 Pad full' : badge === 'survey' ? ' 🗺 Land for sale' : '';
		const tip = drills === 0 ? 'Tap the planet to mine by hand. Open it to build drills.' : `${drills} drill${drills > 1 ? 's' : ''}, ${p.ships.length} ship${p.ships.length > 1 ? 's' : ''}. Each tap mines ${fmt(tapValue(session.g, i))}.${flag}`;
		html = `<div class="card__head"><span class="card__dot" style="color:${def.color}"></span><span class="card__title">${def.name}</span><span class="card__sub">${def.ore}<br>${sub}</span></div>
			<p>${tip}</p>
			<div class="card__row"><button class="btn" data-act="open" id="card-open">Open factory</button>${session.g.unlocks.includes('ships') ? `<button class="btn btn--ghost" data-act="ships">Ships</button>` : ''}${session.g.unlocks.includes('crew') ? `<button class="btn btn--ghost" data-act="crew">Crew</button>` : ''}</div>`;
	} else {
		const can = session.g.credits >= def.unlock;
		const machine = def.newMachine ? MACHINES[def.newMachine].name : '';
		const pct = Math.min(100, (session.g.credits / def.unlock) * 100);
		html = `<div class="card__head"><span class="card__dot" style="color:${def.color}"></span><span class="card__title">${def.name}</span><span class="card__sub">New ore: ${def.ore}</span></div>
			<p>Ore here sells for <b>${def.value}x</b> Cinder ore.${machine ? ` Unlocks the <b>${machine}</b>.` : ''}</p>
			<div class="goal__bar" style="margin-bottom:10px"><i style="width:${pct}%"></i></div>
			<div class="card__row"><button class="btn ${can ? 'btn--gold' : ''}" data-act="unlock" ${can ? '' : 'disabled'}>Unlock ${fmt(def.unlock)}</button></div>`;
	}
	if (ui.card.dataset.html !== html) {
		ui.card.dataset.html = html;
		ui.card.innerHTML = html;
	}
	ui.card.hidden = false;
}

/** Adds the listeners. main.ts calls it once, at boot. */
export function initPlanetCard() {
	ui.card.addEventListener('click', (e) => {
		const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-act]');
		if (!b || b.disabled) return;
		const i = space.selected;
		if (b.dataset.act === 'open') toPlanet(i);
		if (b.dataset.act === 'ships') openShips(i);
		if (b.dataset.act === 'crew') openCrew(i);
		if (b.dataset.act === 'unlock') {
			if (unlockPlanet(session.g, i)) {
				sfx.unlock();
				buzz(30);
				const p = space.screenPos(i);
				ring(p.x, p.y, PLANETS[i].color, p.r, 300, 1);
				ring(p.x, p.y, '#ffffff', p.r * 0.6, 200, 0.7);
				burst(p.x, p.y, PLANETS[i].color, 40, 300, { size: 4, life: 1 });
				session.flash = 0.6;
				toastUnlock(`${PLANETS[i].name} unlocked`, `New ore: ${PLANETS[i].ore}. Open it to build.`);
				checkProgress(session.g);
				saveGame(session.g);
				updateCard();
			} else sfx.error();
		}
	});
}
