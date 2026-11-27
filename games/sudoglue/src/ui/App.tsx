/** Screens, saving, settings, and the back button. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { audio } from '../app/audio.ts';
import { moveFocus, useGamepad, useKeys } from '../app/input.ts';
import type { GameSave, SaveData, Settings } from '../app/save.ts';
import { defaultSettings, finish, liveStreak, load, store } from '../app/save.ts';
import { dailyPuzzle, dateKey, practicePuzzle } from '../core/daily.ts';
import type { Level, Puzzle } from '../core/types.ts';
import { GlassDefs } from './bits.tsx';
import { LEVEL_INFO, Practice, Records, Rules, SettingsModal, Title, Week, dayLabel } from './Menus.tsx';
import { Play } from './Play.tsx';

type Screen =
	| { name: 'title' }
	| { name: 'week' }
	| { name: 'practice' }
	| { name: 'records' }
	| { name: 'rules'; from: Screen }
	| { name: 'play'; puzzle: Puzzle; label: string; sub: string; day?: string; level?: Level; n?: number; from: 'title' | 'week' | 'practice' };

const DEV_BRUSH = import.meta.env.DEV && new URLSearchParams(location.search).get('controls') === 'brush';

export function App() {
	const [data, setData] = useState<SaveData>(load);
	const [screen, setScreen] = useState<Screen>({ name: 'title' });
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [backSignal, setBackSignal] = useState(0);
	const [keysShown, setKeysShown] = useState(() => matchMedia('(pointer: fine)').matches);
	const [playKey, setPlayKey] = useState(0);
	const [today, setToday] = useState(() => dateKey(new Date()));
	const dataRef = useRef(data);
	dataRef.current = data;

	const reduceOS = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)'), []);
	const [osCalm, setOsCalm] = useState(reduceOS.matches);
	useEffect(() => {
		const fn = () => setOsCalm(reduceOS.matches);
		reduceOS.addEventListener('change', fn);
		return () => reduceOS.removeEventListener('change', fn);
	}, [reduceOS]);
	const calm = data.settings.motion === 'reduced' || (data.settings.motion === 'auto' && osCalm);

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
		history.pushState({ sudoglue: true }, '');
		const onPop = () => {
			history.pushState({ sudoglue: true }, '');
			goBack();
		};
		window.addEventListener('popstate', onPop);
		return () => window.removeEventListener('popstate', onPop);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	function goBack() {
		const s = screenRef.current;
		if (settingsRef.current) return setSettingsOpen(false);
		if (s.name === 'play') return setBackSignal((n) => n + 1);
		if (s.name === 'rules') return setScreen(s.from);
		if (s.name !== 'title') return setScreen({ name: 'title' });
	}

	const startDaily = (day: string, from: 'title' | 'week') => {
		audio.play('page');
		const puzzle = dailyPuzzle(day);
		setScreen({ name: 'play', puzzle, label: day === today ? 'Today’s window' : dayLabel(day), sub: `${dayLabel(day)} · ${LEVEL_INFO[puzzle.level].name}`, day, from });
		setPlayKey((k) => k + 1);
	};
	const startPractice = (level: Level) => {
		audio.play('page');
		const n = dataRef.current.practice[level];
		setScreen({ name: 'play', puzzle: practicePuzzle(level, n), label: `Practice #${n + 1}`, sub: LEVEL_INFO[level].name, level, n, from: 'practice' });
		setPlayKey((k) => k + 1);
	};

	const onFinish = (s: Extract<Screen, { name: 'play' }>, f: { time: number; hints: number; shown: number }) => {
		const d = dataRef.current;
		const res = finish(d, s.puzzle.id, s.puzzle.level, { ...f, on: today }, today, s.day);
		let next = res.data;
		if (s.level && s.n !== undefined) next = { ...next, practice: { ...next.practice, [s.level]: Math.max(next.practice[s.level], s.n + 1) } };
		store(next);
		setData(next);
		return { isBest: res.isBest, best: next.records[s.puzzle.level][0]?.time ?? null, streak: liveStreak(next, today), dailyToday: s.day === today };
	};

	// Menu screens: arrows and the gamepad move between buttons.
	useKeys((e) => {
		setKeysShown(true);
		if (screenRef.current.name === 'play' && !settingsRef.current) return;
		if (e.target instanceof HTMLInputElement && e.target.type === 'range' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
		if (e.key.startsWith('Arrow')) {
			e.preventDefault();
			moveFocus(e.key.slice(5).toLowerCase() as 'up');
		} else if (e.key === 'Escape') {
			e.preventDefault();
			goBack();
		}
	});
	useGamepad(
		(cmd) => {
			if (screenRef.current.name === 'play' && !settingsRef.current) return;
			if (cmd === 'up' || cmd === 'down' || cmd === 'left' || cmd === 'right') {
				const el = document.activeElement;
				if (el instanceof HTMLInputElement && el.type === 'range' && (cmd === 'left' || cmd === 'right')) {
					el.value = String(Number(el.value) + (cmd === 'left' ? -0.1 : 0.1));
					el.dispatchEvent(new Event('input', { bubbles: true }));
					return;
				}
				moveFocus(cmd);
			} else if (cmd === 'a') (document.activeElement as HTMLElement | null)?.click();
			else if (cmd === 'b' || cmd === 'start') goBack();
		},
		() => setKeysShown(true),
	);

	const setSettings = (s: Settings) => update((d) => ({ ...d, settings: s }));

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
					onRecords={() => setScreen({ name: 'records' })}
					onRules={() => setScreen({ name: 'rules', from: screen })}
					onSettings={() => setSettingsOpen(true)}
				/>
			);
			break;
		case 'week':
			body = <Week data={data} today={today} onPlay={(day) => startDaily(day, 'week')} onBack={() => setScreen({ name: 'title' })} />;
			break;
		case 'practice':
			body = <Practice data={data} onPlay={startPractice} onBack={() => setScreen({ name: 'title' })} />;
			break;
		case 'records':
			body = <Records data={data} today={today} onBack={() => setScreen({ name: 'title' })} />;
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
					calm={calm}
					keysShown={keysShown}
					tutorial={!data.tutorialDone}
					brushMode={DEV_BRUSH}
					onTutorialDone={() => update((d) => ({ ...d, tutorialDone: true }))}
					onSave={(g: GameSave) => update((d) => ({ ...d, games: { ...d.games, [s.puzzle.id]: g } }))}
					onFinish={(f) => onFinish(s, f)}
					onQuit={leave}
					onNext={s.level ? () => startPractice(s.level!) : s.from === 'week' ? () => setScreen({ name: 'week' }) : undefined}
					nextLabel={s.level ? 'Next window' : s.from === 'week' ? 'Back to the week' : undefined}
					onSettings={() => setSettingsOpen(true)}
					onRules={() => setScreen({ name: 'rules', from: screen })}
					backSignal={backSignal}
					covered={settingsOpen}
				/>
			);
			break;
		}
	}

	return (
		<div className={`app${calm ? ' calm' : ''}`}>
			<GlassDefs />
			{body}
			{settingsOpen && (
				<SettingsModal
					settings={data.settings}
					onChange={setSettings}
					onClose={() => setSettingsOpen(false)}
					onTutorial={() => {
						update((d) => ({ ...d, tutorialDone: false }));
						setSettingsOpen(false);
					}}
					onWipe={() => {
						const fresh = { ...load(), games: {}, finished: {}, tutorialDone: false, settings: defaultSettings() };
						fresh.records = { easy: [], medium: [], hard: [], expert: [] };
						fresh.practice = { easy: 0, medium: 0, hard: 0, expert: 0 };
						fresh.streak = { current: 0, best: 0, lastDay: '' };
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
