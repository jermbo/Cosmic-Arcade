// Coins, buying and using shop items, and putting the chosen looks on screen.
import { setSoundPack } from '../audio.ts';
import { persist, save } from '../save.ts';
import { MOTION_FEEL, SECTIONS, type Category, type ShopItem } from './catalog.ts';

const listeners = new Set<() => void>();

/** Runs `fn` whenever the coin balance changes. Returns a stop function. */
export function onCoins(fn: () => void): () => void {
	listeners.add(fn);
	return () => listeners.delete(fn);
}

export function coins(): number {
	return save.coins;
}

export function earn(amount: number): number {
	amount = Math.max(0, Math.round(amount));
	if (!amount) return 0;
	save.coins += amount;
	persist();
	listeners.forEach((fn) => fn());
	return amount;
}

export function owns(cat: Category, id: string): boolean {
	return (save.owned[cat] ??= []).includes(id) || SECTIONS.find((s) => s.id === cat)!.items[0].id === id;
}

export function inUse(cat: Category): string {
	return save.looks[cat];
}

/** Buys an item and puts it in use. False when there are not enough coins. */
export function buy(cat: Category, item: ShopItem): boolean {
	if (owns(cat, item.id)) return true;
	if (save.coins < item.price) return false;
	save.coins -= item.price;
	(save.owned[cat] ??= []).push(item.id);
	use(cat, item.id);
	listeners.forEach((fn) => fn());
	return true;
}

export function use(cat: Category, id: string): void {
	if (!owns(cat, id)) return;
	save.looks[cat] = id;
	persist();
	applyLooks();
}

/** Puts the chosen theme, tile style, motion and sound pack in place. */
export function applyLooks(): void {
	const root = document.documentElement;
	root.dataset.theme = save.looks.theme;
	root.dataset.tiles = save.looks.tiles;
	root.dataset.motion = save.looks.motion;
	const feel = MOTION_FEEL[save.looks.motion] ?? MOTION_FEEL.bouncy;
	root.style.setProperty('--t', String(feel.speed));
	root.style.setProperty('--spring', feel.spring);
	root.style.setProperty('--out', feel.out);
	const meta = document.querySelector('meta[name="theme-color"]');
	const page = getComputedStyle(root).getPropertyValue('--paper').trim();
	if (meta && page) meta.setAttribute('content', page);
	setSoundPack(save.looks.sound);
}

/** Speed factor of the chosen motion style, for animations run from code. */
export function motionSpeed(): number {
	return (MOTION_FEEL[save.looks.motion] ?? MOTION_FEEL.bouncy).speed;
}
