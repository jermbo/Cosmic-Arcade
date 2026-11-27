/**
 * The controls under (or beside) the window. Pick a tile, then tap a number and a
 * color. This "tile first, split tray" style won against "pane first" painting;
 * see the README. The painting style is kept only as a dev prototype (?controls=brush).
 */
import type { Board } from '../core/types.ts';
import { GLASS } from './art.ts';
import { Icon, MiniPane, NumeralIcon, Swatch } from './bits.tsx';

interface Props {
	board: Board;
	givens: Board;
	sel: number;
	notesMode: boolean;
	noteNum: number;
	noteColor: number;
	keys: boolean;
	canUndo: boolean;
	canRedo: boolean;
	hintsUsed: number;
	/** Dev prototype: armed brush values (-1 for none). */
	brush?: { num: number; color: number } | null;
	onNum: (v: number) => void;
	onColor: (v: number) => void;
	onErase: () => void;
	onUndo: () => void;
	onRedo: () => void;
	onNotes: () => void;
	onHint: () => void;
}

const NUM_KEYS = ['1', '2', '3', '4'];
const COLOR_KEYS = ['Q', 'W', 'E', 'R'];

export function Tray(p: Props) {
	const { board, sel } = p;
	const lockedNum = p.givens.num[sel] >= 0;
	const lockedColor = p.givens.color[sel] >= 0;
	return (
		<div className={`tray${p.notesMode ? ' notes-on' : ''}`}>
			<div className="tray-row" role="group" aria-label="Numbers">
				{[0, 1, 2, 3].map((v) => {
					const count = board.num.filter((n) => n === v).length;
					const on = p.brush ? p.brush.num === v : board.num[sel] === v;
					const noted = p.notesMode && p.noteNum & (1 << v);
					return (
						<button
							key={v}
							className={`key key-num${on ? ' on' : ''}${noted ? ' noted' : ''}${count >= 4 ? ' spent' : ''}`}
							disabled={!p.brush && lockedNum && !p.notesMode}
							onClick={() => p.onNum(v)}
							aria-label={`Number ${v + 1}${p.notesMode ? ' note' : ''}`}
							aria-pressed={!!on}
						>
							<NumeralIcon v={v} size={p.notesMode ? 26 : 34} />
							<span className="pips" aria-hidden="true">
								{[0, 1, 2, 3].map((k) => (
									<i key={k} className={k < count ? 'full' : ''} />
								))}
							</span>
							{p.keys && <kbd>{NUM_KEYS[v]}</kbd>}
						</button>
					);
				})}
			</div>
			<div className="tray-row" role="group" aria-label="Glass colors">
				{[0, 1, 2, 3].map((v) => {
					const count = board.color.filter((n) => n === v).length;
					const on = p.brush ? p.brush.color === v : board.color[sel] === v;
					const noted = p.notesMode && p.noteColor & (1 << v);
					return (
						<button
							key={v}
							className={`key key-color${on ? ' on' : ''}${noted ? ' noted' : ''}${count >= 4 ? ' spent' : ''}`}
							disabled={!p.brush && lockedColor && !p.notesMode}
							onClick={() => p.onColor(v)}
							aria-label={`${GLASS[v].name} glass${p.notesMode ? ' note' : ''}`}
							aria-pressed={!!on}
							style={{ ['--glass' as string]: GLASS[v].base }}
						>
							<Swatch c={v} size={p.notesMode ? 24 : 30} />
							<span className="key-name">{GLASS[v].name}</span>
							{p.keys && <kbd>{COLOR_KEYS[v]}</kbd>}
						</button>
					);
				})}
			</div>
			<div className="tools">
				<button className="tool" onClick={p.onUndo} disabled={!p.canUndo} aria-label="Undo">
					<Icon name="undo" />
					<span>Undo</span>
					{p.keys && <kbd>Z</kbd>}
				</button>
				<button className="tool" onClick={p.onRedo} disabled={!p.canRedo} aria-label="Redo">
					<Icon name="redo" />
					<span>Redo</span>
					{p.keys && <kbd>Y</kbd>}
				</button>
				<button className={`tool${p.notesMode ? ' on' : ''}`} onClick={p.onNotes} aria-pressed={p.notesMode} aria-label="Pencil notes">
					<Icon name="pencil" />
					<span>{p.notesMode ? 'Notes on' : 'Notes'}</span>
					{p.keys && <kbd>N</kbd>}
				</button>
				<button className="tool" onClick={p.onErase} aria-label="Erase tile">
					<Icon name="erase" />
					<span>Erase</span>
					{p.keys && <kbd>⌫</kbd>}
				</button>
				<button className="tool tool-hint" onClick={p.onHint} aria-label="Hint">
					<Icon name="bulb" />
					<span>Hint</span>
					{p.keys && <kbd>H</kbd>}
				</button>
			</div>
		</div>
	);
}

/** The pair rack: all 16 number + color pairs, lit when on the board. */
export function PairRack({ counts, onPick, pickedPair }: { counts: number[]; onPick: (pair: number) => void; pickedPair: number }) {
	const used = counts.filter((c) => c > 0).length;
	return (
		<div className="rack" role="group" aria-label={`Pairs used: ${used} of 16`}>
			<div className="rack-title">
				Pairs <b>{used}</b>/16
			</div>
			<div className="rack-grid">
				<span />
				{[0, 1, 2, 3].map((c) => (
					<span key={`h${c}`} className="rack-head">
						<Swatch c={c} size={15} round={4} />
					</span>
				))}
				{[0, 1, 2, 3].map((n) => (
					<FragmentRow key={n} n={n} counts={counts} onPick={onPick} pickedPair={pickedPair} />
				))}
			</div>
		</div>
	);
}

function FragmentRow({ n, counts, onPick, pickedPair }: { n: number; counts: number[]; onPick: (pair: number) => void; pickedPair: number }) {
	return (
		<>
			<span className="rack-head">
				<NumeralIcon v={n} size={15} />
			</span>
			{[0, 1, 2, 3].map((c) => {
				const p = n * 4 + c;
				const k = counts[p];
				return (
					<button
						key={c}
						className={`slot${k === 1 ? ' used' : ''}${k > 1 ? ' twice' : ''}${pickedPair === p ? ' picked' : ''}`}
						onClick={() => onPick(p)}
						aria-label={`${GLASS[c].name} ${n + 1}: ${k === 0 ? 'not used' : k === 1 ? 'used' : 'used twice'}`}
					>
						{k > 0 ? <MiniPane n={n} c={c} size={22} /> : <i />}
					</button>
				);
			})}
		</>
	);
}
