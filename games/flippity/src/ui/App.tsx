/** Screens, saving, settings, and the back button. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { applyLooks } from '@arcade/cozy-kit/themes.js';
import { audio } from '../app/audio.ts';
import type { GameState } from '../app/game.ts';
import { newGame } from '../app/game.ts';
import { moveFocus, useKeys } from '../app/input.ts';
import { canInstall, isStandalone, promptInstall, setupPwa } from '../app/pwa.ts';
import type { SaveData, Settings } from '../app/save.ts';
import { buy, finishGame, freshSave, load, spend, store } from '../app/save.ts';
import type { Item } from '../app/shop.ts';
import { LOOK_KEY } from '../app/shop.ts';
import { DARK, LIGHT } from '../core/rules.ts';
import { NewGame, Rules, SettingsModal, Title } from './Menus.tsx';
import { Play } from './Play.tsx';
import { Shop } from './Shop.tsx';

type Screen = { name: 'title' } | { name: 'new' } | { name: 'play' } | { name: 'shop'; from: Screen } | { name: 'rules'; from: Screen };

export function App() {
	const [data, setData] = useState<SaveData>(load);
	const [screen, setScreen] = useState<Screen>({ name: 'title' });
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [playKey, setPlayKey] = useState(0);
	/** The game Play started from. Play keeps its own copy, so its end sheet stays after the save clears. */
	const [playing, setPlaying] = useState<GameState | null>(null);
	const dataRef = useRef(data);
	dataRef.current = data;

	// Offline play and the Install button (shown only when the browser offers it).
	const [installable, setInstallable] = useState(false);
	useEffect(() => setupPwa(() => setInstallable(canInstall() && !isStandalone())), []);

	const reduceOS = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)'), []);
	const [osCalm, setOsCalm] = useState(reduceOS.matches);
	useEffect(() => {
		const fn = () => setOsCalm(reduceOS.matches);
		reduceOS.addEventListener('change', fn);
		return () => reduceOS.removeEventListener('change', fn);
	}, [reduceOS]);
	const calm = data.settings.motion === 'reduced' || (data.settings.motion === 'auto' && osCalm);

	// Looks live on <html>, so every screen and dialog follows them.
	useEffect(() => {
		applyLooks(data.looks.theme, data.settings.style);
		document.documentElement.classList.toggle('calm', calm);
	}, [data.looks.theme, data.settings.style, calm]);
	useEffect(() => audio.setPack(data.looks.sound), [data.looks.sound]);
	useEffect(() => {
		audio.haptics = data.settings.haptics;
	}, [data.settings.haptics]);

	const update = (fn: (d: SaveData) => SaveData) => {
		const next = fn(dataRef.current);
		dataRef.current = next;
		store(next);
		setData(next);
	};

	// Sound needs one tap or key first. Then music follows the setting.
	useEffect(() => {
		const unlock = () => {
			audio.unlock();
			audio.setMusic(dataRef.current.settings.music > 0);
		};
		window.addEventListener('pointerdown', unlock);
		window.addEventListener('keydown', unlock);
		return () => {
			window.removeEventListener('pointerdown', unlock);
			window.removeEventListener('keydown', unlock);
		};
	}, []);
	useEffect(() => {
		audio.setLevels(data.settings.sound, data.settings.music);
		audio.setMusic(data.settings.music > 0);
	}, [data.settings.sound, data.settings.music]);

	// The back button steps back inside the game, never out of it.
	const screenRef = useRef(screen);
	screenRef.current = screen;
	const settingsRef = useRef(settingsOpen);
	settingsRef.current = settingsOpen;
	useEffect(() => {
		history.pushState({ flippity: true }, '');
		const onPop = () => {
			history.pushState({ flippity: true }, '');
			goBack();
		};
		window.addEventListener('popstate', onPop);
		return () => window.removeEventListener('popstate', onPop);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	function goBack() {
		const s = screenRef.current;
		if (settingsRef.current) return setSettingsOpen(false);
		if (s.name === 'rules' || s.name === 'shop') return setScreen(s.from);
		// A game is saved after every move, so leaving it is safe.
		if (s.name !== 'title') return setScreen({ name: 'title' });
	}

	const startGame = () => {
		const s = dataRef.current.setup;
		const g = newGame(s.size, s.opponent, s.first ? DARK : LIGHT);
		update((d) => ({ ...d, game: g }));
		setPlaying(g);
		audio.play('page');
		setPlayKey((k) => k + 1);
		setScreen({ name: 'play' });
	};

	useKeys((e) => {
		if (screenRef.current.name === 'play' && !settingsRef.current) {
			if (e.key === 'Escape') goBack();
			return;
		}
		if (e.target instanceof HTMLInputElement && e.target.type === 'range' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
		if (e.target instanceof HTMLSelectElement) return;
		if (e.key.startsWith('Arrow')) {
			e.preventDefault();
			moveFocus(e.key.slice(5).toLowerCase() as 'up');
		} else if (e.key === 'Escape') {
			e.preventDefault();
			goBack();
		}
	});

	const setSettings = (s: Settings) => update((d) => ({ ...d, settings: s }));

	const buyItem = (item: Item) => {
		const next = buy(dataRef.current, item.id, item.price);
		if (!next) {
			audio.play('blocked');
			return false;
		}
		audio.play('buy');
		update(() => ({ ...next, looks: { ...next.looks, [LOOK_KEY[item.kind]]: item.id } }));
		return true;
	};
	const useItem = (item: Item) => {
		audio.play('ui');
		update((d) => ({ ...d, looks: { ...d.looks, [LOOK_KEY[item.kind]]: item.id } }));
	};

	let body;
	switch (screen.name) {
		case 'title':
			body = (
				<Title
					data={data}
					calm={calm}
					onContinue={() => {
						audio.play('page');
						setPlaying(dataRef.current.game);
						setPlayKey((k) => k + 1);
						setScreen({ name: 'play' });
					}}
					onNew={() => setScreen({ name: 'new' })}
					onRules={() => setScreen({ name: 'rules', from: screen })}
					onShop={() => setScreen({ name: 'shop', from: screen })}
					onSettings={() => setSettingsOpen(true)}
					onInstall={installable ? () => void promptInstall().then(() => setInstallable(canInstall() && !isStandalone())) : undefined}
				/>
			);
			break;
		case 'new':
			body = <NewGame data={data} onChange={(s) => update((d) => ({ ...d, setup: s }))} onStart={startGame} onBack={() => setScreen({ name: 'title' })} />;
			break;
		case 'shop':
			body = <Shop pips={data.pips} owned={data.owned} looks={data.looks} onBuy={buyItem} onUse={useItem} onBack={() => setScreen(screen.from)} />;
			break;
		case 'rules':
			body = <Rules onBack={() => setScreen(screen.from)} />;
			break;
		case 'play': {
			if (!playing) {
				body = null;
				break;
			}
			body = (
				<Play
					key={playKey}
					initial={playing}
					settings={data.settings}
					stoneLook={data.looks.stone}
					calm={calm}
					pips={data.pips}
					covered={settingsOpen}
					onSave={(g: GameState) => update((d) => ({ ...d, game: g }))}
					onSpend={(price) => {
						const next = spend(dataRef.current, price);
						if (!next) return false;
						update(() => next);
						return true;
					}}
					onFinish={(g) => {
						const r = finishGame(dataRef.current, g);
						update(() => r.data);
						return { outcome: r.outcome, winner: r.winner, dark: r.dark, light: r.light, earned: r.earned, total: r.total, pips: r.data.pips };
					}}
					onQuit={() => setScreen({ name: 'title' })}
					onAgain={startGame}
					onNewGame={() => setScreen({ name: 'new' })}
					onSettings={() => setSettingsOpen(true)}
				/>
			);
			break;
		}
	}

	return (
		<div className={`app${calm ? ' calm' : ''}`}>
			<div className="screen-fade" key={screen.name === 'play' ? `play-${playKey}` : screen.name}>
				{body}
			</div>
			{settingsOpen && (
				<SettingsModal
					settings={data.settings}
					onChange={setSettings}
					onClose={() => setSettingsOpen(false)}
					onShop={() => {
						setSettingsOpen(false);
						setScreen({ name: 'shop', from: screenRef.current.name === 'play' ? { name: 'title' } : screenRef.current });
					}}
					onWipe={() => {
						const fresh = freshSave();
						dataRef.current = fresh;
						store(fresh);
						setData(fresh);
						setSettingsOpen(false);
						setScreen({ name: 'title' });
					}}
				/>
			)}
		</div>
	);
}
