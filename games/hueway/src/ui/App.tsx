/** Screens, saving, settings, and the back button. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { audio } from '../app/audio.ts';
import { moveFocus, useKeys } from '../app/input.ts';
import { canInstall, isStandalone, promptInstall, setupPwa } from '../app/pwa.ts';
import type { GameSave, SaveData, Settings } from '../app/save.ts';
import { buy, finish, finishClock, freshSave, liveStreak, load, newTrip, roadStop, store } from '../app/save.ts';
import type { Item } from '../app/shop.ts';
import { LEVEL_NAME, LOOK_KEY } from '../app/shop.ts';
import { dailyPuzzle, dateKey, practicePuzzle } from '../core/daily.ts';
import type { Level, Puzzle } from '../core/types.ts';
import { ClockRun, EndlessMenu, RoadTrip } from './Endless.tsx';
import { Practice, Rules, SettingsModal, Title, Week, dayLabel } from './Menus.tsx';
import { Play } from './Play.tsx';
import { Shop } from './Shop.tsx';

type Screen =
	| { name: 'title' }
	| { name: 'week' }
	| { name: 'practice' }
	| { name: 'endless' }
	| { name: 'clock' }
	| { name: 'road' }
	| { name: 'shop'; from: Screen }
	| { name: 'rules'; from: Screen }
	| { name: 'play'; puzzle: Puzzle; label: string; sub: string; day?: string; level?: Level; n?: number; from: 'title' | 'week' | 'practice' };

export function App() {
	const [data, setData] = useState<SaveData>(load);
	const [screen, setScreen] = useState<Screen>({ name: 'title' });
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [backSignal, setBackSignal] = useState(0);
	const [keysShown, setKeysShown] = useState(false);
	const [playKey, setPlayKey] = useState(0);
	const [today, setToday] = useState(() => dateKey(new Date()));
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
		const root = document.documentElement;
		root.dataset.theme = data.looks.theme;
		root.classList.toggle('calm', calm);
		const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
		document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || '#f4eee4');
	}, [data.looks.theme, calm]);
	useEffect(() => audio.setPack(data.looks.sound), [data.looks.sound]);

	// The date can roll over while the game is open.
	useEffect(() => {
		const id = window.setInterval(() => setToday(dateKey(new Date())), 30000);
		return () => clearInterval(id);
	}, []);

	const update = (fn: (d: SaveData) => SaveData) => {
		setData((d) => {
			const next = fn(d);
			store(next);
			return next;
		});
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
		history.pushState({ hueway: true }, '');
		const onPop = () => {
			history.pushState({ hueway: true }, '');
			goBack();
		};
		window.addEventListener('popstate', onPop);
		return () => window.removeEventListener('popstate', onPop);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	function goBack() {
		const s = screenRef.current;
		if (settingsRef.current) return setSettingsOpen(false);
		if (s.name === 'play' || s.name === 'clock') return setBackSignal((n) => n + 1);
		if (s.name === 'road') return setScreen({ name: 'endless' });
		if (s.name === 'rules' || s.name === 'shop') return setScreen(s.from);
		if (s.name !== 'title') return setScreen({ name: 'title' });
	}

	const startDaily = (day: string, from: 'title' | 'week') => {
		audio.play('page');
		const puzzle = dailyPuzzle(day);
		const name = day === today ? 'Today' : dayLabel(day);
		setScreen({ name: 'play', puzzle, label: day === today ? 'Today’s puzzle' : dayLabel(day), sub: `${name} · ${LEVEL_NAME[puzzle.level]} · ${puzzle.w}×${puzzle.h}`, day, from });
		setPlayKey((k) => k + 1);
	};
	const startPractice = (level: Level) => {
		audio.play('page');
		const n = dataRef.current.practice[level];
		const puzzle = practicePuzzle(level, n);
		setScreen({ name: 'play', puzzle, label: `Practice #${n + 1}`, sub: `${LEVEL_NAME[level]} · ${puzzle.w}×${puzzle.h}`, level, n, from: 'practice' });
		setPlayKey((k) => k + 1);
	};

	const onFinish = (s: Extract<Screen, { name: 'play' }>, f: { time: number; hints: number; moves: number; perfect: boolean }) => {
		const d = dataRef.current;
		const res = finish(d, s.puzzle.id, s.puzzle.level, { ...f, on: today }, today, s.day);
		let next = res.data;
		if (s.level && s.n !== undefined) next = { ...next, practice: { ...next.practice, [s.level]: Math.max(next.practice[s.level], s.n + 1) } };
		store(next);
		setData(next);
		if (res.earned.length) window.setTimeout(() => audio.play('coin'), 1600);
		return {
			isBest: res.isBest,
			best: next.records[s.puzzle.level][0]?.time ?? null,
			streak: liveStreak(next, today),
			dailyToday: s.day === today,
			earned: res.earned,
			coins: next.coins,
		};
	};

	// Menu screens: arrows move between buttons.
	useKeys((e) => {
		if (e.key.startsWith('Arrow') || e.key === ' ' || e.key === 'Tab') setKeysShown(true);
		if (['play', 'clock', 'road'].includes(screenRef.current.name) && !settingsRef.current) {
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
					today={today}
					onToday={() => startDaily(today, 'title')}
					onWeek={() => setScreen({ name: 'week' })}
					onPractice={() => setScreen({ name: 'practice' })}
					onEndless={() => setScreen({ name: 'endless' })}
					onRules={() => setScreen({ name: 'rules', from: screen })}
					onShop={() => setScreen({ name: 'shop', from: screen })}
					onSettings={() => setSettingsOpen(true)}
					onInstall={installable ? () => void promptInstall().then(() => setInstallable(canInstall() && !isStandalone())) : undefined}
				/>
			);
			break;
		case 'shop':
			body = <Shop coins={data.coins} owned={data.owned} looks={data.looks} onBuy={buyItem} onUse={useItem} onBack={() => setScreen(screen.from)} />;
			break;
		case 'week':
			body = <Week data={data} today={today} onPlay={(day) => startDaily(day, 'week')} onBack={() => setScreen({ name: 'title' })} />;
			break;
		case 'endless':
			body = (
				<EndlessMenu
					endless={data.endless}
					onClock={() => {
						audio.play('page');
						setScreen({ name: 'clock' });
					}}
					onRoad={() => {
						audio.play('page');
						setScreen({ name: 'road' });
					}}
					onNewTrip={() => {
						update(newTrip);
						audio.play('page');
						setScreen({ name: 'road' });
					}}
					onBack={() => setScreen({ name: 'title' })}
				/>
			);
			break;
		case 'clock':
			body = (
				<ClockRun
					looks={data.looks}
					settings={data.settings}
					best={data.endless.clockBest}
					covered={settingsOpen}
					backSignal={backSignal}
					onFinish={(boards) => {
						const res = finishClock(dataRef.current, boards);
						store(res.data);
						setData(res.data);
						return { earned: res.earned, isBest: res.isBest, coins: res.data.coins };
					}}
					onSettings={() => setSettingsOpen(true)}
					onExit={() => setScreen({ name: 'endless' })}
				/>
			);
			break;
		case 'road':
			body = (
				<RoadTrip
					endless={data.endless}
					looks={data.looks}
					settings={data.settings}
					onSave={(paths) => update((d) => ({ ...d, endless: { ...d.endless, paths } }))}
					onStop={(leg) => {
						const res = roadStop(dataRef.current, leg);
						store(res.data);
						setData(res.data);
						return { earned: res.earned, coins: res.data.coins };
					}}
					onNewTrip={() => update(newTrip)}
					onSettings={() => setSettingsOpen(true)}
					onExit={() => setScreen({ name: 'endless' })}
				/>
			);
			break;
		case 'practice':
			body = <Practice data={data} onPlay={startPractice} onBack={() => setScreen({ name: 'title' })} />;
			break;
		case 'rules':
			body = <Rules onBack={() => setScreen(screen.from)} />;
			break;
		case 'play': {
			const s = screen;
			const leave = () => setScreen(s.from === 'week' ? { name: 'week' } : s.from === 'practice' ? { name: 'practice' } : { name: 'title' });
			body = (
				<Play
					key={playKey}
					puzzle={s.puzzle}
					label={s.label}
					sub={s.sub}
					saved={data.games[s.puzzle.id]}
					settings={data.settings}
					looks={data.looks}
					calm={calm}
					keysShown={keysShown}
					tutorial={!data.tutorialDone}
					onTutorialDone={() => update((d) => ({ ...d, tutorialDone: true }))}
					onSave={(g: GameSave) => update((d) => ({ ...d, games: { ...d.games, [s.puzzle.id]: g } }))}
					onFinish={(f) => onFinish(s, f)}
					onQuit={leave}
					onNext={s.level ? () => startPractice(s.level!) : s.from === 'week' ? () => setScreen({ name: 'week' }) : undefined}
					nextLabel={s.level ? 'Next puzzle' : s.from === 'week' ? 'Back to the week' : undefined}
					onSettings={() => setSettingsOpen(true)}
					backSignal={backSignal}
					covered={settingsOpen}
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
						// From a game too: the game saves as it closes.
						setSettingsOpen(false);
						setScreen({ name: 'shop', from: ['play', 'clock', 'road'].includes(screenRef.current.name) ? { name: 'title' } : screenRef.current });
					}}
					onTutorial={() => {
						update((d) => ({ ...d, tutorialDone: false }));
						setSettingsOpen(false);
					}}
					onWipe={() => {
						const fresh = freshSave();
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
