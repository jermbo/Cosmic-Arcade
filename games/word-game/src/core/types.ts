// Data shapes shared by the builder, the modes and the test script.

export type Level = 1 | 2 | 3 | 4;
export type ModeId = 'crack' | 'secret' | 'link' | 'blitz';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Mark = 'hit' | 'near' | 'miss';

/** One entry in the group bank: a theme with 5 to 8 words. */
export interface Group {
	id: string;
	level: Level;
	theme: string;
	words: string[];
}

/** A group as it sits on one board: exactly 4 words. */
export interface BoardGroup {
	id: string;
	level: Level;
	theme: string;
	words: string[];
}

/** 16 tiles from 4 groups, one group per level. */
export interface Board {
	groups: BoardGroup[];
	tiles: string[];
}

export interface CrackPuzzle {
	board: Board;
	/** One locked word per group, in the order of board.groups. */
	locked: string[];
	/** For each locked word, the letters shown from the start (null = hidden). */
	hints: (string | null)[][];
}

export interface SecretPuzzle {
	board: Board;
	word: string;
	/** The theme of the group the secret word comes from. */
	clue: string;
	/** The letter spots each solved group shows, in order. */
	reveal: number[];
}

export interface LinkRound {
	group: BoardGroup;
	/** The true theme plus decoys, shuffled. */
	options: string[];
}

export interface LinkPuzzle {
	rounds: LinkRound[];
}

/** A hand-made puzzle in src/data/puzzles.json. */
export interface HandPuzzle {
	id: string;
	/** Local date (YYYY-MM-DD) it is the daily for. */
	date?: string;
	/** Leave out to use it for every mode. */
	mode?: ModeId;
	groups: { theme: string; level: Level; words: string[] }[];
}
