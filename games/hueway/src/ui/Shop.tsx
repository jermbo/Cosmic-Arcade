/** The shop: themes, line styles, dot styles and sound packs. Every item shows a live preview. */
import { useState } from 'react';
import { audio } from '../app/audio.ts';
import type { Item, Kind, Looks } from '../app/shop.ts';
import { CATALOG, LOOK_KEY } from '../app/shop.ts';
import type { Puzzle } from '../core/types.ts';
import { Board } from './Board.tsx';
import { CoinChip, Icon } from './bits.tsx';
import { Tint } from './Tint.tsx';

/** A tiny solved board for the previews: three colors on 4 × 3. */
const PREVIEW: Puzzle = {
	id: 'preview',
	seed: 0,
	level: 'easy',
	w: 4,
	h: 3,
	pairs: [
		{ a: 0, b: 3 },
		{ a: 4, b: 8 },
		{ a: 6, b: 10 },
	],
	solution: [
		[0, 1, 2, 3],
		[4, 5, 9, 8],
		[6, 7, 11, 10],
	],
};

const TABS: { kind: Kind; name: string }[] = [
	{ kind: 'theme', name: 'Themes' },
	{ kind: 'line', name: 'Lines' },
	{ kind: 'dot', name: 'Dots' },
	{ kind: 'sound', name: 'Sounds' },
];

interface ShopProps {
	coins: number;
	owned: string[];
	looks: Looks;
	onBuy: (item: Item) => boolean;
	onUse: (item: Item) => void;
	onBack: () => void;
}

export function Shop({ coins, owned, looks, onBuy, onUse, onBack }: ShopProps) {
	const [tab, setTab] = useState<Kind>('theme');
	const [short, setShort] = useState<string | null>(null);
	const items = CATALOG.filter((i) => i.kind === tab);

	const preview = (item: Item) => {
		const l = { ...looks, [LOOK_KEY[item.kind]]: item.id };
		if (item.kind === 'sound')
			return (
				<div className="pv pv-sound">
					<Tint mood="happy" color={CATALOG.filter((i) => i.kind === 'sound').indexOf(item) + 1} size={44} />
				</div>
			);
		return (
			<div className="pv" data-theme={item.kind === 'theme' ? item.id : undefined}>
				<Board puzzle={PREVIEW} paths={PREVIEW.solution} lineLook={l.line} dotLook={l.dot} marks={false} tint drawing={-1} linked={[true, true, true]} label={`${item.name} preview`} />
			</div>
		);
	};

	return (
		<main className="menu page shop">
			<header className="bar">
				<button type="button" className="icon-btn" onClick={onBack} aria-label="Back">
					<Icon name="back" />
				</button>
				<div className="bar-title">
					<b>Shop</b>
				</div>
				<CoinChip coins={coins} />
			</header>
			<div className="tabs" role="tablist">
				{TABS.map((t) => (
					<button
						key={t.kind}
						type="button"
						role="tab"
						aria-selected={tab === t.kind}
						className={tab === t.kind ? 'on' : ''}
						onClick={() => {
							setTab(t.kind);
							audio.play('ui');
						}}
					>
						{t.name}
					</button>
				))}
			</div>
			<ul className="shop-grid">
				{items.map((item) => {
					const has = owned.includes(item.id);
					const using = looks[LOOK_KEY[item.kind]] === item.id;
					return (
						<li key={item.id} className={`shop-item${using ? ' using' : ''}`}>
							{preview(item)}
							<div className="shop-text">
								<b>
									{item.name}
									{item.tone && <span className="tone">{item.tone}</span>}
								</b>
								<span>{item.blurb}</span>
							</div>
							<div className="shop-actions">
								{item.kind === 'sound' && (
									<button type="button" className="icon-btn small" aria-label={`Hear ${item.name}`} onClick={() => void audio.preview(item.id)}>
										<Icon name="speaker" size={18} />
									</button>
								)}
								{using ? (
									<span className="in-use">
										<Icon name="check" size={16} /> In use
									</span>
								) : has ? (
									<button type="button" className="btn small" onClick={() => onUse(item)}>
										Use
									</button>
								) : (
									<button
										type="button"
										className={`btn small primary${short === item.id ? ' shake' : ''}`}
										onClick={() => {
											if (!onBuy(item)) {
												setShort(item.id);
												window.setTimeout(() => setShort(null), 500);
											}
										}}
										aria-label={`Buy ${item.name} for ${item.price} coins`}
									>
										<Icon name="coin" size={16} /> {item.price}
									</button>
								)}
							</div>
						</li>
					);
				})}
			</ul>
			<p className="muted center">Solve puzzles to earn coins. Bigger boards pay more.</p>
		</main>
	);
}
