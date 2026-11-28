/** The shop: themes, pebble styles and sound packs. Every item shows a live preview. */
import { useState } from 'react';
import { audio } from '../app/audio.ts';
import type { Item, Kind, Looks } from '../app/shop.ts';
import { CATALOG, LOOK_KEY } from '../app/shop.ts';
import type { Side } from '../core/rules.ts';
import { Icon, PipChip, PipIcon, Stone } from './bits.tsx';

const TABS: { kind: Kind; name: string }[] = [
	{ kind: 'theme', name: 'Themes' },
	{ kind: 'stone', name: 'Pebbles' },
	{ kind: 'sound', name: 'Sounds' },
];

/** A tiny tray of 2 × 2 pebbles for the previews. */
const PREVIEW: Side[] = [2, 1, 1, 2];

interface ShopProps {
	pips: number;
	owned: string[];
	looks: Looks;
	onBuy: (item: Item) => boolean;
	onUse: (item: Item) => void;
	onBack: () => void;
}

export function Shop({ pips, owned, looks, onBuy, onUse, onBack }: ShopProps) {
	const [tab, setTab] = useState<Kind>('theme');
	const [short, setShort] = useState<string | null>(null);
	const items = CATALOG.filter((i) => i.kind === tab);

	const preview = (item: Item) => {
		const stone = item.kind === 'stone' ? item.id : looks.stone;
		return (
			<div className="pv" data-theme={item.kind === 'theme' ? item.id : undefined}>
				<div className={`pv-tray stones-${stone}`}>
					{PREVIEW.map((s, i) => (
						<span key={i} className="pv-cell">
							<span className="dip" />
							<span className="stone-wrap">
								<Stone side={s} />
							</span>
						</span>
					))}
				</div>
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
				<PipChip pips={pips} />
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
										aria-label={`Buy ${item.name} for ${item.price} pips`}
									>
										<PipIcon size={16} /> {item.price}
									</button>
								)}
							</div>
						</li>
					);
				})}
			</ul>
			<p className="muted center">Beat a bot to earn Pips. Big flips and corners pay too.</p>
		</main>
	);
}
