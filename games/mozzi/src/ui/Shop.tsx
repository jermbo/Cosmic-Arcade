/** The shop: themes, tile styles and sound packs, bought with coins from mended windows. */
import { useState } from 'react';
import { audio } from '../app/audio.ts';
import type { Item, Kind, Looks } from '../app/shop.ts';
import { CATALOG, EARN } from '../app/shop.ts';
import { Icon } from './bits.tsx';
import { Back, CoinChip } from './Menus.tsx';

const TABS: { kind: Kind; name: string }[] = [
	{ kind: 'theme', name: 'Themes' },
	{ kind: 'tiles', name: 'Tiles' },
	{ kind: 'sound', name: 'Sounds' },
];

const LOOK_KEY: Record<Kind, keyof Looks> = { theme: 'theme', tiles: 'tiles', sound: 'sound' };

interface Props {
	coins: number;
	owned: string[];
	looks: Looks;
	onBuy: (item: Item) => boolean;
	onUse: (item: Item) => void;
	onBack: () => void;
}

/** A small board drawn in the item's theme and tile style, so you see before you buy. */
function Preview({ item, looks }: { item: Item; looks: Looks }) {
	const theme = item.kind === 'theme' ? item.id : looks.theme;
	const tiles = item.kind === 'tiles' ? item.id : looks.tiles;
	const cells: [number, number][] = [
		[0, 0],
		[1, 1],
		[2, 2],
		[2, 3],
		[3, 2],
		[-1, 0],
	];
	return (
		<span className="preview" data-theme={theme} data-tiles={tiles} aria-hidden="true">
			{cells.map(([n, c], i) => (
				<span key={i} className={`tile k${c}`}>
					<span className="face">
						<span className="glass" />
						{n >= 0 && <span className={`num${i === 0 ? ' given' : ''}`}>{n + 1}</span>}
					</span>
				</span>
			))}
		</span>
	);
}

export function Shop({ coins, owned, looks, onBuy, onUse, onBack }: Props) {
	const [tab, setTab] = useState<Kind>('theme');
	const [shake, setShake] = useState('');
	const [justBought, setJustBought] = useState('');
	return (
		<main className="screen shop" data-layer>
			<Back onBack={onBack} title="Shop">
				<CoinChip coins={coins} />
			</Back>
			<p className="muted lead">
				Earn coins by mending windows: {EARN.level.easy}–{EARN.level.expert} per window, more with no hints, a new best or a daily streak.
			</p>
			<div className="tabs" role="tablist">
				{TABS.map((t) => (
					<button key={t.kind} role="tab" aria-selected={tab === t.kind} className={tab === t.kind ? 'on' : ''} onClick={() => setTab(t.kind)}>
						{t.name}
					</button>
				))}
			</div>
			<div className="shop-grid" role="tabpanel">
				{CATALOG.filter((i) => i.kind === tab).map((item, k) => {
					const have = owned.includes(item.id);
					const using = looks[LOOK_KEY[item.kind]] === item.id;
					return (
						<article key={item.id} className={`puff shop-item${using ? ' using' : ''}${shake === item.id ? ' shake' : ''}${justBought === item.id ? ' bought' : ''}`} style={{ ['--i' as string]: k }}>
							{item.kind === 'sound' ? (
								<button className="sound-preview" onClick={() => void audio.preview(item.id)} aria-label={`Play a sample of ${item.name}`}>
									<Icon name="speaker" size={28} />
									<span>Listen</span>
								</button>
							) : (
								<Preview item={item} looks={looks} />
							)}
							<div className="shop-text">
								<b>
									{item.name}
									{item.tone && <span className="tone">{item.tone}</span>}
								</b>
								<small>{item.blurb}</small>
							</div>
							{using ? (
								<span className="shop-state">
									<Icon name="check" size={16} /> In use
								</span>
							) : have ? (
								<button className="btn btn-small" onClick={() => onUse(item)}>
									Use
								</button>
							) : (
								<button
									className="btn btn-small btn-main"
									onClick={() => {
										if (onBuy(item)) {
											setJustBought(item.id);
											window.setTimeout(() => setJustBought(''), 700);
										} else {
											setShake(item.id);
											window.setTimeout(() => setShake(''), 400);
										}
									}}
									aria-label={`Buy ${item.name} for ${item.price} coins`}
								>
									<Icon name="coin" size={16} /> {item.price}
								</button>
							)}
						</article>
					);
				})}
			</div>
		</main>
	);
}
