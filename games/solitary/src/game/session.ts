import { variantKey, type DealOptions, type Hint, type ModeId, type Move, type State } from '../core/types.ts';
import { makeRules, type Rules } from '../rules/index.ts';
import { countPlayed } from '../store/bests.ts';
import { clearGame, saveGame, type SavedGame } from '../store/savegame.ts';
import { settings } from '../store/settings.ts';

export type ChangeKind = 'move' | 'stock' | 'undo' | 'auto' | 'restore';

export interface Change {
	kind: ChangeKind;
	/** Cards that changed pile. */
	moved: number[];
	/** A card turned face up. */
	flipped: boolean;
	/** Cards landed on a foundation. */
	home: boolean;
	/** Draw, redeal or deal, for the sound. */
	stock?: 'draw' | 'redeal' | 'deal';
}

const AUTO_DELAY = 120;
const FINISH_DELAY = 75;

/** One game: the board, undo history, timer, moves and hints. No DOM here. */
export class Session {
	readonly rules: Rules;
	readonly mode: ModeId;
	readonly opts: DealOptions;
	state: State;
	history: State[] = [];
	moves = 0;
	hintsUsed = false;
	won = false;
	started = false;
	paused = false;
	onChange: (change: Change) => void = () => {};
	onWin: () => void = () => {};

	private elapsedBefore = 0;
	private runningSince: number | null = null;
	private autoTimer = 0;
	private hintList: Hint[] | null = null;
	private hintIndex = 0;
	private finishing = false;

	constructor(mode: ModeId, opts: DealOptions, seed: number, saved?: SavedGame) {
		this.mode = mode;
		this.opts = { ...opts };
		this.rules = makeRules(mode, this.opts, seed);
		this.state = saved ? saved.state : this.rules.initial();
		if (saved) {
			this.moves = saved.moves;
			this.elapsedBefore = saved.elapsed;
			this.hintsUsed = saved.hintsUsed;
			this.started = saved.moves > 0;
		}
	}

	get variant(): string {
		return variantKey(this.mode, this.opts);
	}

	get seed(): number {
		return this.rules.seed;
	}

	/** A game counts as begun once the player has made a move. */
	get midGame(): boolean {
		return this.moves > 0 && !this.won;
	}

	time(): number {
		const running = this.runningSince === null ? 0 : performance.now() - this.runningSince;
		return this.elapsedBefore + running;
	}

	setPaused(paused: boolean) {
		this.paused = paused;
		this.syncClock();
	}

	private syncClock() {
		const shouldRun = this.started && !this.paused && !this.won;
		if (shouldRun && this.runningSince === null) this.runningSince = performance.now();
		if (!shouldRun && this.runningSince !== null) {
			this.elapsedBefore += performance.now() - this.runningSince;
			this.runningSince = null;
		}
	}

	private begin() {
		if (!this.started) {
			this.started = true;
			countPlayed(this.variant);
		}
		this.syncClock();
	}

	canMove(move: Move): boolean {
		return !this.won && this.rules.canMove(this.state, move);
	}

	/** A player move. False when it is not legal. */
	move(move: Move): boolean {
		this.flush();
		if (!this.canMove(move)) return false;
		const before = this.state;
		this.push();
		this.state = this.rules.apply(this.state, move, true);
		this.moves++;
		this.begin();
		this.emit('move', before);
		this.afterPlayer();
		return true;
	}

	/** Tap the stock. Returns a message when the rules refuse. */
	stock(): true | string | null {
		this.flush();
		if (this.won) return null;
		const result = this.rules.stock(this.state);
		if (!result || typeof result === 'string') return result;
		const before = this.state;
		this.push();
		this.state = result.state;
		this.moves++;
		this.begin();
		this.emit('stock', before, result.kind);
		this.afterPlayer();
		return true;
	}

	canUndo(): boolean {
		return !this.won && this.history.length > 0;
	}

	undo(): boolean {
		this.flush();
		if (!this.canUndo()) return false;
		const before = this.state;
		this.state = this.history.pop()!;
		this.moves++;
		this.emit('undo', before);
		return true;
	}

	/** The next hint. Each call shows the next legal move in the list. */
	hint(): Hint | null {
		this.flush();
		if (this.won) return null;
		if (!this.hintList) {
			this.hintList = this.rules.hints(this.state);
			this.hintIndex = 0;
		}
		if (this.hintList.length === 0) return null;
		const hint = this.hintList[this.hintIndex % this.hintList.length];
		this.hintIndex++;
		this.hintsUsed = true;
		this.persist();
		return hint;
	}

	/** Finish any auto-moves still waiting, at once. */
	flush() {
		if (!this.autoTimer) return;
		clearTimeout(this.autoTimer);
		this.autoTimer = 0;
		const before = this.state;
		let any = false;
		for (let m = this.nextAuto(); m; m = this.nextAuto()) {
			this.state = this.rules.apply(this.state, m, false);
			any = true;
		}
		if (any) this.emit('auto', before);
		this.checkWin();
	}

	private nextAuto(): Move | null {
		if (this.won) return null;
		if (this.finishing) return this.rules.finishMove(this.state);
		if (!settings.autoMove) return null;
		const m = this.rules.autoMove(this.state);
		if (m) return m;
		return this.rules.canFinish(this.state) ? this.rules.finishMove(this.state) : null;
	}

	/** The board is solved and auto-move is off: offer to play it out. */
	canFinish(): boolean {
		return !this.won && !this.finishing && !settings.autoMove && this.rules.canFinish(this.state);
	}

	/** Play a solved board out, one card at a time. Not a move, so not undoable on its own. */
	finish() {
		if (!this.rules.canFinish(this.state) || this.won) return;
		this.finishing = true;
		this.push();
		this.moves++;
		this.begin();
		this.schedule(FINISH_DELAY);
	}

	private afterPlayer() {
		if (this.checkWin()) return;
		this.schedule(AUTO_DELAY);
	}

	private schedule(delay: number) {
		clearTimeout(this.autoTimer);
		this.autoTimer = 0;
		if (!this.nextAuto()) return;
		this.autoTimer = window.setTimeout(() => {
			this.autoTimer = 0;
			const m = this.nextAuto();
			if (!m) return;
			const finishing = this.finishing || this.rules.canFinish(this.state);
			const before = this.state;
			this.state = this.rules.apply(this.state, m, false);
			this.emit('auto', before);
			if (!this.checkWin()) this.schedule(finishing ? FINISH_DELAY : AUTO_DELAY);
		}, delay);
	}

	/** Auto-move was turned on mid-game, or the deal just landed. */
	settingsChanged(delay = AUTO_DELAY) {
		if (!this.autoTimer) this.schedule(delay);
	}

	private checkWin(): boolean {
		if (this.won || !this.rules.isWon(this.state)) return false;
		this.won = true;
		this.syncClock();
		clearGame();
		this.onWin();
		return true;
	}

	private push() {
		this.history.push(this.state);
		this.hintList = null;
	}

	private emit(kind: ChangeKind, before: State, stock?: Change['stock']) {
		this.hintList = null;
		const where = new Map<number, string>();
		const upBefore = new Set<number>();
		for (const pile in before.piles) for (const c of before.piles[pile]) {
			where.set(c.id, pile);
			if (c.up) upBefore.add(c.id);
		}
		const moved: number[] = [];
		let flipped = false;
		let home = false;
		for (const pile in this.state.piles) for (const c of this.state.piles[pile]) {
			if (where.get(c.id) !== pile) {
				moved.push(c.id);
				if (this.rules.kind(pile) === 'foundation') home = true;
			}
			if (c.up && !upBefore.has(c.id) && this.rules.kind(pile) === 'tableau') flipped = true;
		}
		this.onChange({ kind, moved, flipped, home, stock });
		this.persist();
	}

	persist() {
		if (this.won || !this.started) return;
		saveGame({
			v: 1,
			mode: this.mode,
			opts: this.opts,
			seed: this.seed,
			state: this.state,
			moves: this.moves,
			elapsed: this.time(),
			hintsUsed: this.hintsUsed,
		});
	}

	dispose() {
		clearTimeout(this.autoTimer);
		this.autoTimer = 0;
		this.onChange = () => {};
		this.onWin = () => {};
	}
}
