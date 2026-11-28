/**
 * Drawing lines on one board, with undo and sound. Used by the Endless modes.
 * Give the component that uses it a `key` of the puzzle id, so a new board starts clean.
 */
import { useMemo, useRef, useState } from 'react';
import type { Puzzle } from '../core/types.ts';
import { audio } from './audio.ts';
import type { Drag, Paths } from './game.ts';
import { dragTo, dragView, emptyPaths, isLinked, isSolved, progress, samePaths, startDrag } from './game.ts';

interface Options {
	initial?: Paths;
	haptics: boolean;
	/** After each change that sticks (for saving). */
	onChange?: (paths: Paths) => void;
	onSolved?: (paths: Paths) => void;
}

export function useLines(p: Puzzle, o: Options) {
	const [paths, setPaths] = useState<Paths>(() => (o.initial && o.initial.length === p.pairs.length ? o.initial : emptyPaths(p)));
	const [drag, setDrag] = useState<Drag | null>(null);
	const [history, setHistory] = useState<Paths[]>([]);
	const [pulse, setPulse] = useState(-1);
	const [solved, setSolved] = useState(false);
	const dragRef = useRef<Drag | null>(null);
	const pathsRef = useRef(paths);
	pathsRef.current = paths;
	const opts = useRef(o);
	opts.current = o;

	const view = drag ? dragView(drag) : paths;
	const linked = useMemo(() => p.pairs.map((_, k) => isLinked(p, view, k)), [p, view]);
	const buzz = (ms: number) => opts.current.haptics && navigator.vibrate?.(ms);
	const flash = (k: number) => {
		setPulse(k);
		window.setTimeout(() => setPulse(-1), 650);
	};

	function commit(next: Paths) {
		if (samePaths(pathsRef.current, next)) return;
		setHistory((h) => [...h.slice(-60), pathsRef.current]);
		pathsRef.current = next;
		setPaths(next);
		opts.current.onChange?.(next);
		if (isSolved(p, next)) {
			setSolved(true);
			buzz(30);
			opts.current.onSolved?.(next);
		}
	}

	return {
		view,
		linked,
		pulse,
		solved,
		drawing: drag ? drag.color : -1,
		progress: progress(p, view),
		canUndo: history.length > 0 && !solved,
		down(cell: number) {
			if (solved) return;
			const d = startDrag(p, pathsRef.current, cell);
			if (!d) return;
			dragRef.current = d;
			setDrag(d);
			audio.play('pick');
			buzz(6);
		},
		move(cell: number) {
			const d = dragRef.current;
			if (!d) return;
			const next = dragTo(p, d, cell);
			if (next.path === d.path) return;
			if (next.path.length > d.path.length) {
				audio.step(next.color, next.path.length);
				if (isLinked(p, dragView(next), next.color)) {
					audio.play('link');
					flash(next.color);
					buzz(14);
				}
			}
			dragRef.current = next;
			setDrag(next);
		},
		up() {
			const d = dragRef.current;
			if (!d) return;
			dragRef.current = null;
			setDrag(null);
			if (d.path.length === 1 && d.base[d.color].length > 1) audio.play('clear');
			commit(dragView(d));
		},
		undo() {
			if (!history.length || solved) return;
			const prev = history[history.length - 1];
			pathsRef.current = prev;
			setPaths(prev);
			setHistory((h) => h.slice(0, -1));
			opts.current.onChange?.(prev);
			audio.play('undo');
		},
		clear() {
			if (solved) return;
			commit(emptyPaths(p));
			audio.play('clear');
		},
	};
}

export type Lines = ReturnType<typeof useLines>;
