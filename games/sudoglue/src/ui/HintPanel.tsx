/** The hint card: where, then why, then what. */
import { useState } from 'react';
import type { HintView } from '../app/game.ts';
import { TIER_NAMES } from '../core/logic.ts';
import type { Tier } from '../core/logic.ts';
import { Icon, Words } from './bits.tsx';
import type { Marks } from './Board.tsx';

export const RULES: Record<Tier, string> = {
	1: 'Each row and each column has every number once and every color once.',
	2: 'Each number + color pair is used once in the whole window. A finished pane uses up its pair.',
	3: 'Every pair has to go somewhere. If only one tile can still hold it, it goes there.',
	4: 'Any two rows trade in pairs: if row 1 has a 2 where row 3 has a 4, then row 1 has a 4 where row 3 has a 2. The same goes for columns, and for colors.',
};

export function marksFor(view: HintView | null, flash: number[]): Marks | null {
	if (!view) return null;
	const h = view.hint;
	if (h.kind === 'wrong') return { target: h.cell, focus: [], blockers: view.level >= 2 ? h.clashWith : [], ruled: [], flash };
	if (h.kind !== 'step') return null;
	const ex = h.ex;
	if (view.level === 1) return { target: ex.target, focus: ex.focus, blockers: [], ruled: [], flash };
	return {
		target: ex.target,
		focus: ex.focus,
		blockers: [...new Set(ex.reasons.flatMap((r) => r.cells))].filter((c) => c !== ex.target),
		ruled: ex.reasons.flatMap((r) => (r.about !== undefined ? [r.about] : [])),
		flash,
	};
}

interface Props {
	view: HintView;
	onWhy: () => void;
	onShow: () => void;
	onClose: () => void;
	onFlash: (cells: number[]) => void;
	keys: boolean;
}

export function HintPanel({ view, onWhy, onShow, onClose, onFlash, keys }: Props) {
	const h = view.hint;
	const [ruleOpen, setRuleOpen] = useState(false);
	const steps = (
		<ol className="hint-steps" aria-label="Hint level">
			{['Where', 'Why', 'What'].map((name, i) => (
				<li key={name} className={view.level > i ? 'on' : ''}>
					{name}
				</li>
			))}
		</ol>
	);
	const close = (
		<button className="icon-btn" onClick={onClose} aria-label="Close hint">
			<Icon name="close" size={18} />
		</button>
	);

	if (h.kind === 'done' || h.kind === 'stuck') {
		return (
			<section className="hint card" aria-live="polite">
				<header>
					<b>Hint</b>
					{close}
				</header>
				<p>{h.kind === 'done' ? 'Every pane is in. Nice work!' : 'No step found. This should never happen; try Undo.'}</p>
			</section>
		);
	}

	if (h.kind === 'wrong') {
		return (
			<section className="hint card hint-wrong" aria-live="polite">
				<header>
					{steps}
					{close}
				</header>
				<p className="hint-lead">
					<Words s={h.where} />
				</p>
				{view.level >= 2 && (
					<ul className="reasons">
						{h.why.map((s, i) => (
							<li key={i} onPointerEnter={() => onFlash(h.clashWith)} onPointerLeave={() => onFlash([])}>
								<span>
									<Words s={s} />
								</span>
							</li>
						))}
					</ul>
				)}
				<div className="hint-actions">
					{view.level < 2 && (
						<button className="btn" onClick={onWhy}>
							Why? {keys && <kbd>H</kbd>}
						</button>
					)}
					<button className="btn btn-main" onClick={onShow}>
						Take it off
					</button>
				</div>
			</section>
		);
	}

	const ex = h.ex;
	return (
		<section className="hint card" aria-live="polite">
			<header>
				{steps}
				{close}
			</header>
			<p className="hint-lead">
				<Words s={ex.where} />
			</p>
			{view.level >= 2 && (
				<>
					<button className="rule-tag" onClick={() => setRuleOpen((o) => !o)} aria-expanded={ruleOpen}>
						Rule: <b>{TIER_NAMES[ex.tier]}</b> <span aria-hidden="true">{ruleOpen ? '−' : '+'}</span>
					</button>
					{ruleOpen && <p className="rule-text">{RULES[ex.tier]}</p>}
					<p className="hint-q">
						<Words s={ex.question} />
					</p>
					<ul className="reasons">
						{ex.reasons.map((r, i) => (
							<li
								key={i}
								onPointerEnter={() => onFlash([...r.cells, ...(r.about !== undefined ? [r.about] : [])])}
								onPointerLeave={() => onFlash([])}
								onClick={() => onFlash([...r.cells, ...(r.about !== undefined ? [r.about] : [])])}
							>
								<span className="x" aria-hidden="true">
									✕
								</span>
								<span>
									<Words s={r.says} />
								</span>
							</li>
						))}
					</ul>
					<p className="hint-answer">
						<Words s={ex.answer} />
					</p>
				</>
			)}
			<div className="hint-actions">
				{view.level < 2 && (
					<button className="btn" onClick={onWhy}>
						Why? {keys && <kbd>H</kbd>}
					</button>
				)}
				<button className="btn btn-main" onClick={onShow}>
					{view.level < 2 ? 'Just show me' : 'Glue it in'} {keys && view.level >= 2 && <kbd>H</kbd>}
				</button>
			</div>
		</section>
	);
}
