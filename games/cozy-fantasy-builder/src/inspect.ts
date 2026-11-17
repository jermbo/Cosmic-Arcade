/** Looking at one elf: the card with its day, the path it walks, and following it with the camera. */

import * as THREE from 'three';
import { JOB, JOBS, PIECE, TRAIT } from './content.ts';
import type { JobId } from './content.ts';
import { blockAt, blockName, clockText, dayPlan, nextBlock } from './brain.ts';
import { livingFolk, openSlots, setJob } from './folk.ts';
import type { Folk } from './folk.ts';
import { bodyOf, refreshJobs, routeOf, villagers } from './life.ts';
import { S, saveSoon } from './state.ts';
import { unkey } from './util.ts';
import { groundY, world } from './view.ts';

/** What the shell does for the buttons of the card. */
export const inspectActions = {
	follow: (_x: number, _z: number) => {},
	control: (_id: number) => {},
	visitHome: (_home: string) => {},
	opened: (_open: boolean) => {},
	click: () => {},
	toast: (_text: string, _sub: string) => {},
};

export const inspect = {
	/** The elf that the card shows, or null. */
	id: null as number | null,
	following: false,
	picking: false,
};

const card = document.getElementById('card') as HTMLElement;
let liveTimer = 0;
/** The card and the path are hidden for a while, as when the player walks as an elf. */
let quiet = false;

/* The path on the ground */

const DOTS = 160;
const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false });
const dots = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 8), dotMat, DOTS);
dots.count = 0;
dots.frustumCulled = false;
dots.renderOrder = 3;
const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false });
const target = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.035, 6, 24), ringMat);
target.rotation.x = -Math.PI / 2;
target.renderOrder = 3;
const feet = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 20), ringMat);
feet.rotation.x = -Math.PI / 2;
feet.renderOrder = 3;
const _m = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3(1, 1, 1);

export function initInspect(): void {
	world.add(dots, target, feet);
	target.visible = feet.visible = false;
	card.addEventListener('click', onClick);
}

function drawPath(f: Folk, time: number): void {
	const v = bodyOf(f.id);
	const route = routeOf(f.id);
	const color = JOB[f.job].color;
	dotMat.color.set(color).lerp(new THREE.Color(0xffffff), 0.35);
	ringMat.color.set(color).lerp(new THREE.Color(0xffffff), 0.2);
	let n = 0;
	// Dots every so often along the way. They drift forward, so the way reads as a direction.
	const gap = 0.28;
	let carry = gap - ((time * 0.5) % gap);
	for (let i = 1; i < route.length && n < DOTS; i++) {
		const [ax, az] = route[i - 1];
		const [bx, bz] = route[i];
		const len = Math.hypot(bx - ax, bz - az);
		let d = carry;
		while (d < len && n < DOTS) {
			const x = ax + ((bx - ax) * d) / len;
			const z = az + ((bz - az) * d) / len;
			_m.compose(_v.set(x, groundY(x, z) + 0.05, z), _q, _s);
			dots.setMatrixAt(n++, _m);
			d += gap;
		}
		carry = d - len;
	}
	dots.count = n;
	dots.instanceMatrix.needsUpdate = true;
	const cell = v?.goal?.cell;
	if (v && v.state !== 'inside' && cell) {
		const [x, z] = unkey(cell);
		target.visible = true;
		target.position.set(x, groundY(x, z) + 0.06, z);
		target.scale.setScalar(1 + Math.sin(time * 4) * 0.08);
	} else target.visible = false;
	if (v && v.obj.visible) {
		feet.visible = true;
		feet.position.set(v.x, groundY(v.x, v.z) + 0.04, v.z);
	} else feet.visible = false;
}

/* The card */

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

function doing(f: Folk): { now: string; where: string } {
	const v = bodyOf(f.id);
	if (!v) return { now: 'Away', where: '' };
	if (v.state === 'driven') return { now: 'Walking where you lead', where: '' };
	if (v.state === 'inside') {
		const b = blockAt(f);
		return { now: b.kind === 'sleep' ? 'Sleeping' : v.goal?.act === 'home' ? v.goal.label : 'At home', where: 'Home' };
	}
	const g = v.goal;
	if (!g) return { now: 'Thinking what to do', where: '' };
	return { now: v.state === 'walk' ? `On the way: ${g.label.toLowerCase()}` : g.label, where: g.place };
}

function homeName(f: Folk): string {
	const p = f.home ? S.pieces.get(f.home) : undefined;
	return p ? PIECE[p.t].name : 'No home';
}

function workName(f: Folk): string {
	if (f.job === 'none') return 'No job. Free to wander';
	const def = JOB[f.job];
	if (def.perTour) return `${def.name}. Walks to ${(def.tour ?? []).map((t) => PIECE[t].name.toLowerCase()).join(', ')}`;
	const p = f.work ? S.pieces.get(f.work) : undefined;
	return p ? `${def.name} at the ${PIECE[p.t].name.toLowerCase()}` : `${def.name}. No workplace`;
}

function planHtml(f: Folk): string {
	const now = blockAt(f);
	return `<ol class="plan">${dayPlan(f)
		.map((b) => `<li class="${b.kind === now.kind && b.from === now.from ? 'on' : ''}"><time>${clockText(b.from)}</time><span>${blockName(f, b)}</span></li>`)
		.join('')}</ol>`;
}

function jobsHtml(f: Folk): string {
	const folk = livingFolk();
	return `<div class="jobs" role="group" aria-label="Jobs">${JOBS.map((j) => {
		const open = openSlots(j.id, folk);
		const mine = f.job === j.id;
		const note = j.id === 'none' ? 'Wanders all day' : mine ? 'Now' : open > 0 ? `${open} free` : 'Full';
		return `<button type="button" data-job="${j.id}" aria-pressed="${mine}" ${!mine && open <= 0 ? 'disabled' : ''}><span class="card__dot" style="background:${hex(j.color)}"></span>${j.name}<small>${note}</small></button>`;
	}).join('')}</div>`;
}

function render(): void {
	const f = inspect.id === null ? undefined : S.folk.get(inspect.id);
	if (!f) {
		close();
		return;
	}
	const traits = f.traits.map((t) => TRAIT[t].name).join(', ');
	const { now, where } = doing(f);
	const next = nextBlock(f);
	card.innerHTML = `
		<div class="card__head">
			<span class="card__dot" style="background:${hex(JOB[f.job].color)}"></span>
			<h2 class="card__name">${esc(f.name)}</h2>
			<button class="round round--small" type="button" data-card="close" aria-label="Close">
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
			</button>
		</div>
		<p class="card__sub">${JOB[f.job].name}${f.pinned ? ' (your pick)' : ''} · ${traits}</p>
		<dl class="card__facts">
			<dt>Now</dt><dd><span data-live="now">${esc(now)}</span> <small data-live="where">${where ? `at ${esc(where)}` : ''}</small></dd>
			<dt>Next</dt><dd data-live="next">${blockName(f, next)} at ${clockText(next.from)}</dd>
			<dt>Work</dt><dd>${esc(workName(f))}</dd>
			<dt>Home</dt><dd>${esc(homeName(f))}</dd>
			<dt>Time</dt><dd data-live="time">${clockText(S.clock)}</dd>
		</dl>
		<details><summary>Plan for the day</summary><div data-live="plan">${planHtml(f)}</div></details>
		${inspect.picking ? jobsHtml(f) : ''}
		<div class="card__buttons">
			<button class="btn" type="button" data-card="follow" aria-pressed="${inspect.following}">Follow</button>
			<button class="btn btn--go" type="button" data-card="control">Play as</button>
			<button class="btn" type="button" data-card="home" ${f.home ? '' : 'disabled'}>Home</button>
			<button class="btn" type="button" data-card="job" aria-pressed="${inspect.picking}">Job</button>
		</div>`;
}

function updateLive(): void {
	const f = inspect.id === null ? undefined : S.folk.get(inspect.id);
	if (!f) return;
	const { now, where } = doing(f);
	const next = nextBlock(f);
	const set = (k: string, html: string): void => {
		const e = card.querySelector<HTMLElement>(`[data-live="${k}"]`);
		if (e && e.innerHTML !== html) e.innerHTML = html;
	};
	set('now', esc(now));
	set('where', where ? `at ${esc(where)}` : '');
	set('next', `${blockName(f, next)} at ${clockText(next.from)}`);
	set('time', clockText(S.clock));
	set('plan', planHtml(f));
}

function onClick(e: MouseEvent): void {
	const t = e.target as HTMLElement;
	const job = t.closest<HTMLElement>('[data-job]')?.dataset.job as JobId | undefined;
	const f = inspect.id === null ? undefined : S.folk.get(inspect.id);
	if (!f) return;
	if (job) {
		inspectActions.click();
		const problem = setJob(f, job);
		if (problem) inspectActions.toast('That job is full', problem);
		else {
			refreshJobs();
			saveSoon();
			inspect.picking = false;
			inspectActions.toast(`${f.name} is now a ${JOB[f.job].name.toLowerCase()}`, '');
		}
		render();
		return;
	}
	const act = t.closest<HTMLElement>('[data-card]')?.dataset.card;
	if (!act) return;
	inspectActions.click();
	if (act === 'close') close();
	else if (act === 'follow') {
		inspect.following = !inspect.following;
		render();
	} else if (act === 'job') {
		inspect.picking = !inspect.picking;
		render();
	} else if (act === 'control') inspectActions.control(f.id);
	else if (act === 'home' && f.home) inspectActions.visitHome(f.home);
}

/** Shows the card of an elf. */
export function select(id: number, follow = false): void {
	const changed = inspect.id !== id;
	inspect.id = id;
	if (changed) inspect.picking = false;
	if (follow) inspect.following = true;
	card.hidden = false;
	render();
	inspectActions.opened(true);
	const v = bodyOf(id);
	if (v && follow) inspectActions.follow(v.x, v.z);
}

export function close(): void {
	if (inspect.id === null && card.hidden) return;
	inspect.id = null;
	inspect.following = false;
	inspect.picking = false;
	card.hidden = true;
	dots.count = 0;
	target.visible = feet.visible = false;
	inspectActions.opened(false);
}

/** Hides the card for a while, without forgetting the elf. */
export function hideCard(hide: boolean): void {
	quiet = hide;
	if (hide) {
		dots.count = 0;
		target.visible = feet.visible = false;
	}
	if (inspect.id === null) return;
	card.hidden = hide;
	if (!hide) render();
}

/** The player moved the view: stop following. */
export function stopFollow(): void {
	if (!inspect.following) return;
	inspect.following = false;
	const b = card.querySelector('[data-card="follow"]');
	b?.setAttribute('aria-pressed', 'false');
}

export function updateInspect(dt: number, time: number): void {
	if (inspect.id === null) return;
	const f = S.folk.get(inspect.id);
	if (!f || !villagers.some((v) => v.id === f.id)) {
		close();
		return;
	}
	if (!quiet) drawPath(f, time);
	if (inspect.following) {
		const v = bodyOf(f.id);
		if (v) {
			const [x, z] = v.state === 'inside' && f.home ? unkey(f.home) : [v.x, v.z];
			inspectActions.follow(x, z);
		}
	}
	liveTimer -= dt;
	if (liveTimer <= 0 && !card.hidden) {
		liveTimer = 0.35;
		updateLive();
	}
}

/** The list of every elf, for the Elves panel. */
export function folkPanel(): { title: string; html: string } {
	const folk = livingFolk().sort((a, b) => a.name.localeCompare(b.name));
	if (!folk.length) return { title: 'Elves', html: '<p>No elves yet. Grow a home, and an elf will move in.</p>' };
	const working = folk.filter((f) => f.job !== 'none').length;
	return {
		title: `Elves  ${folk.length}`,
		html: `<p>${working} of ${folk.length} have a job. Tap an elf to see its day.</p><ul class="list">${folk
			.map((f) => {
				const { now } = doing(f);
				return `<li class="entry folk-row" data-folk="${f.id}"><span class="entry__mark" style="background:${hex(JOB[f.job].color)};color:#fff">${esc(f.name[0])}</span><span><b>${esc(f.name)}</b><small>${JOB[f.job].name} · ${esc(now)}</small></span><span class="entry__side">›</span></li>`;
			})
			.join('')}</ul>`,
	};
}
