import { newRun, type Run } from '../rules/run.ts';
import { loadSession, type Session } from '../rules/session.ts';
import { openDeck, openSettings, type DisplaySettings } from './dialogs.ts';
import { motion, setFxLayer } from './fx.ts';
import { createHud, type Hud } from './hud.ts';
import { mountBoot } from './screens/boot.ts';
import { mountCombat } from './screens/combat.ts';
import { mountEnding } from './screens/ending.ts';
import { mountLayers } from './screens/layers.ts';
import { mountMap } from './screens/map.ts';
import { mountMenu } from './screens/menu.ts';
import { mountReward } from './screens/reward.ts';
import { mountShop } from './screens/shop.ts';

export type ScreenName = 'boot' | 'menu' | 'layers' | 'map' | 'combat' | 'shop' | 'reward' | 'ending';
export type LogLevel = 'ok' | 'warn' | 'err' | 'sys' | 'gold';

export interface App {
	session: Session;
	run: Run | null;
	stage: HTMLElement;
	hud: Hud;
	display: DisplaySettings;
	screen: ScreenName;
	/** One-shot notes from one screen to the next, such as a new floor splash. */
	flags: { newFloor?: boolean; unlocked?: boolean };
	go(name: ScreenName): void;
	openSettings(): void;
	startRun(layerIndex: number, seed: number): void;
	log(text: string, level?: LogLevel): void;
	logHtml(): string;
}

type Mount = (app: App) => void | (() => void);

const SCREENS: Record<ScreenName, Mount> = {
	boot: mountBoot,
	menu: mountMenu,
	layers: mountLayers,
	map: mountMap,
	combat: mountCombat,
	shop: mountShop,
	reward: mountReward,
	ending: mountEnding,
};

const HUD_SCREENS: ScreenName[] = ['map', 'combat', 'shop', 'reward'];
const LOG_MAX = 60;

export function createApp(root: HTMLElement): App {
	root.innerHTML = `
		<div class="shell">
			<div class="stage" id="stage"></div>
		</div>
		<div class="scanlines" aria-hidden="true"></div>
		<div class="vignette" aria-hidden="true"></div>
		<div class="fx-layer" aria-hidden="true"></div>`;
	const shell = root.querySelector<HTMLElement>('.shell')!;
	const stage = root.querySelector<HTMLElement>('#stage')!;
	setFxLayer(root.querySelector<HTMLElement>('.fx-layer')!);

	const lines: { text: string; level: LogLevel; turn: string }[] = [];
	let cleanup: (() => void) | void;

	const applyDisplay = () => {
		document.documentElement.classList.toggle('no-scanlines', !app.display.scanlines);
		document.documentElement.classList.toggle('is-calm', motion.calm);
	};

	const hud = createHud(
		() => openDeck(app.run),
		() => app.openSettings(),
	);
	shell.prepend(hud.el);

	const stamp = () => {
		const d = new Date();
		return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
	};
	const lineHtml = (l: (typeof lines)[number]) =>
		`<li class="log__line log__line--${l.level}"><span class="log__time">${l.turn}</span><span class="log__tag">${l.level.toUpperCase()}</span>${l.text}</li>`;

	const app: App = {
		session: loadSession(),
		run: null,
		stage,
		hud,
		display: { scanlines: true },
		screen: 'boot',
		flags: {},
		go(name) {
			if (typeof cleanup === 'function') cleanup();
			app.screen = name;
			hud.show(HUD_SCREENS.includes(name) && app.run !== null);
			if (app.run) hud.update(app.run);
			stage.dataset.screen = name;
			stage.innerHTML = '';
			stage.classList.remove('is-entering');
			void stage.offsetWidth;
			stage.classList.add('is-entering');
			window.scrollTo(0, 0);
			cleanup = SCREENS[name](app);
		},
		openSettings: () => openSettings(app.display, applyDisplay),
		startRun(layerIndex, seed) {
			app.run = newRun(layerIndex, seed);
			lines.length = 0;
			hud.reset();
			app.flags.newFloor = true;
			app.log(`Jack-in accepted. Seed ${app.run.seedLabel}.`, 'sys');
			app.log(`Target ${app.run.layer.name}. 4 floors to root.`, 'sys');
			app.go('map');
		},
		log(text, level = 'ok') {
			const line = { text, level, turn: stamp() };
			lines.push(line);
			if (lines.length > LOG_MAX) lines.shift();
			stage.querySelectorAll<HTMLElement>('[data-log]').forEach((ul) => {
				ul.insertAdjacentHTML('beforeend', lineHtml(line));
				while (ul.children.length > LOG_MAX) ul.firstElementChild?.remove();
				ul.scrollTop = ul.scrollHeight;
			});
		},
		logHtml: () => lines.map(lineHtml).join(''),
	};

	applyDisplay();
	return app;
}

/** Scrolls each log panel to the newest line. Call after mount. */
export function settleLogs(root: ParentNode): void {
	root.querySelectorAll<HTMLElement>('[data-log]').forEach((ul) => (ul.scrollTop = ul.scrollHeight));
}
