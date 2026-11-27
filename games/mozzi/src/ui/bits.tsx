/** Small shared parts: tiles in miniature, chips in hint text, and icons. Colors come from the theme. */
import type { ReactNode } from 'react';
import { cellName } from '../core/grid.ts';
import { COLOR_NAMES, SHAPE_NAMES } from '../core/words.ts';
import type { Sentence, Token } from '../core/words.ts';

export const colorName = (c: number) => COLOR_NAMES[c][0].toUpperCase() + COLOR_NAMES[c].slice(1);
export const colorLabel = (c: number) => `${colorName(c)} (${SHAPE_NAMES[c]})`;

/** Ruby circle, cobalt triangle, amber square, jade diamond. */
const SHAPE_PATHS = [
	'M 6 1.4 A 4.6 4.6 0 1 1 5.99 1.4 Z',
	'M 6 1 L 11.2 10.6 L 0.8 10.6 Z',
	'M 1.8 1.8 L 10.2 1.8 L 10.2 10.2 L 1.8 10.2 Z',
	'M 6 0.6 L 11.4 6 L 6 11.4 L 0.6 6 Z',
];

/** A color's symbol. Hidden unless the Color shapes setting is on (or the device asks for more contrast). */
export function Shape({ c }: { c: number }) {
	return (
		<span className="shape" aria-hidden="true">
			<svg viewBox="0 0 12 12">
				<path d={SHAPE_PATHS[c]} fill="currentColor" strokeLinejoin="round" />
			</svg>
		</span>
	);
}

/** A tiny tile: color with its pattern, and a number if given. Follows the theme and tile style. */
export function Mini({ n = -1, c = -1, size = 28, className = '' }: { n?: number; c?: number; size?: number; className?: string }) {
	return (
		<span className={`mini${c >= 0 ? ` k${c}` : ''} ${className}`} style={{ ['--s' as string]: `${size}px` }} aria-hidden="true">
			{n >= 0 && <b>{n + 1}</b>}
			{c >= 0 && <Shape c={c} />}
		</span>
	);
}

/** Draws hint text: tile names, numbers and colors become chips, so color is never the only cue. */
export function Words({ s, onCell }: { s: Sentence; onCell?: (cell: number) => void }) {
	return (
		<>
			{s.map((t, i) => (
				<Chip key={i} t={t} onCell={onCell} />
			))}
		</>
	);
}

function Chip({ t, onCell }: { t: Token; onCell?: (cell: number) => void }): ReactNode {
	if (typeof t === 'string') return t;
	switch (t.t) {
		case 'cell':
			return (
				<b className="chip chip-cell" onPointerEnter={() => onCell?.(t.cell)}>
					{cellName(t.cell)}
				</b>
			);
		case 'num':
			return <b className="chip chip-num">{t.v + 1}</b>;
		case 'color':
			return (
				<b className="chip chip-color">
					<Mini c={t.v} size={14} />
					{COLOR_NAMES[t.v]}
				</b>
			);
		case 'pair':
			return (
				<b className="chip chip-pair">
					<Mini n={t.n} c={t.c} size={18} />
					{COLOR_NAMES[t.c]} {t.n + 1}
				</b>
			);
	}
}

/** Rounded line icons. */
const ICONS: Record<string, string> = {
	undo: 'M 9 8 L 4 13 L 9 18 M 4.5 13 C 10 12.5 15 12 18 14 C 21.5 16.5 20.5 21 16 21',
	redo: 'M 15 8 L 20 13 L 15 18 M 19.5 13 C 14 12.5 9 12 6 14 C 2.5 16.5 3.5 21 8 21',
	pencil: 'M 5 19 L 6 15 L 16 5 C 17 4 18.5 4 19.5 5 C 20.5 6 20.5 7.5 19.5 8.5 L 9.5 18.5 L 5 19 M 14.5 6.5 L 18 10',
	erase: 'M 9 20 L 4.5 15.5 C 3.6 14.6 3.6 13.4 4.5 12.5 L 12.5 4.5 C 13.4 3.6 14.6 3.6 15.5 4.5 L 19.5 8.5 C 20.4 9.4 20.4 10.6 19.5 11.5 L 11 20 M 8 9 L 15 16 M 9 20 L 20 20',
	bulb: 'M 9 17 C 9 14.5 6 12.5 6 9.5 C 6 6 8.8 3.5 12 3.5 C 15.2 3.5 18 6 18 9.5 C 18 12.5 15 14.5 15 17 Z M 9.5 20 L 14.5 20 M 12 7 C 10.5 7 9.3 8 9.2 9.5',
	pause: 'M 9 5 L 9 19 M 15 5 L 15 19',
	gear: 'M 12 8.5 C 14 8.5 15.5 10 15.5 12 C 15.5 14 14 15.5 12 15.5 C 10 15.5 8.5 14 8.5 12 C 8.5 10 10 8.5 12 8.5 M 12 3 L 12 5.5 M 12 18.5 L 12 21 M 3 12 L 5.5 12 M 18.5 12 L 21 12 M 5.6 5.6 L 7.4 7.4 M 16.6 16.6 L 18.4 18.4 M 5.6 18.4 L 7.4 16.6 M 16.6 7.4 L 18.4 5.6',
	back: 'M 14 5 L 7 12 L 14 19',
	close: 'M 6 6 L 18 18 M 18 6 L 6 18',
	play: 'M 8 5 L 18 12 L 8 19 Z',
	reset: 'M 18.5 9 C 17 6 14.5 4.5 11.5 4.5 C 7.5 4.5 4.5 7.8 4.5 12 C 4.5 16.2 7.8 19.5 12 19.5 C 15.5 19.5 18.4 17.2 19.2 14 M 19 4 L 18.8 9.2 L 13.8 8.8',
	book: 'M 4 5.5 C 7 4.5 10 5 12 6.5 C 14 5 17 4.5 20 5.5 L 20 19 C 17 18 14 18.5 12 20 C 10 18.5 7 18 4 19 Z M 12 6.5 L 12 20',
	trophy: 'M 8 4 L 16 4 L 16 9 C 16 12 14 14 12 14 C 10 14 8 12 8 9 Z M 8 6 L 4.5 6 C 4.5 9 6 10.5 8 10.5 M 16 6 L 19.5 6 C 19.5 9 18 10.5 16 10.5 M 12 14 L 12 17.5 M 8.5 20 L 15.5 20 L 14.5 17.5 L 9.5 17.5 Z',
	calendar: 'M 4.5 7 L 19.5 7 L 19.5 19.5 L 4.5 19.5 Z M 4.5 11 L 19.5 11 M 8.5 4.5 L 8.5 8.5 M 15.5 4.5 L 15.5 8.5',
	shuffle: 'M 4 7 L 8 7 C 12 7 12 17 16 17 L 20 17 M 4 17 L 8 17 C 9.5 17 10.5 15.5 11.2 14 M 12.8 10 C 13.5 8.5 14.5 7 16 7 L 20 7 M 17.5 4.5 L 20 7 L 17.5 9.5 M 17.5 14.5 L 20 17 L 17.5 19.5',
	home: 'M 4 11 L 12 4.5 L 20 11 M 6.5 9.5 L 6.5 19.5 L 17.5 19.5 L 17.5 9.5 M 10 19.5 L 10 14 L 14 14 L 14 19.5',
	sun: 'M 12 8 C 14.2 8 16 9.8 16 12 C 16 14.2 14.2 16 12 16 C 9.8 16 8 14.2 8 12 C 8 9.8 9.8 8 12 8 M 12 2.5 L 12 5 M 12 19 L 12 21.5 M 2.5 12 L 5 12 M 19 12 L 21.5 12 M 5.3 5.3 L 7 7 M 17 17 L 18.7 18.7 M 5.3 18.7 L 7 17 M 17 7 L 18.7 5.3',
	coin: 'M 12 4.5 C 16.4 4.5 19.5 7.8 19.5 12 C 19.5 16.2 16.4 19.5 12 19.5 C 7.6 19.5 4.5 16.2 4.5 12 C 4.5 7.8 7.6 4.5 12 4.5 M 12 8 L 12 16 M 9.5 10 C 9.5 8.5 14.5 8.5 14.5 10 C 14.5 11.8 9.5 12 9.5 14 C 9.5 15.6 14.5 15.6 14.5 14',
	shop: 'M 4.5 9 L 6 4.5 L 18 4.5 L 19.5 9 C 19.5 10.5 18 11.5 16.5 11.5 C 15 11.5 14 10.5 14 9 C 14 10.5 13 11.5 12 11.5 C 11 11.5 10 10.5 10 9 C 10 10.5 9 11.5 7.5 11.5 C 6 11.5 4.5 10.5 4.5 9 Z M 6 11.5 L 6 19.5 L 18 19.5 L 18 11.5 M 10 19.5 L 10 15 L 14 15 L 14 19.5',
	grid: 'M 4.5 4.5 L 10.5 4.5 L 10.5 10.5 L 4.5 10.5 Z M 13.5 4.5 L 19.5 4.5 L 19.5 10.5 L 13.5 10.5 Z M 4.5 13.5 L 10.5 13.5 L 10.5 19.5 L 4.5 19.5 Z M 13.5 13.5 L 19.5 13.5 L 19.5 19.5 L 13.5 19.5 Z',
	check: 'M 5 12.5 L 10 17.5 L 19 7',
	speaker: 'M 4.5 9.5 L 8 9.5 L 12.5 5.5 L 12.5 18.5 L 8 14.5 L 4.5 14.5 Z M 15.5 9 C 17 10.5 17 13.5 15.5 15 M 18 6.5 C 21 9.5 21 14.5 18 17.5',
};

export function Icon({ name, size = 22 }: { name: keyof typeof ICONS | string; size?: number }) {
	return (
		<svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="icon">
			<path d={ICONS[name]} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}
