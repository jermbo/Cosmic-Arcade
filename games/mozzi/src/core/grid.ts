/**
 * The shape of the window: 4 rows × 4 columns, 4 numbers and 4 colors.
 *
 * A tile is an index 0..15 (row * 4 + column).
 * A number or a color is 0..3 (shown to the player as 1..4 and as glass colors).
 * A pair is number * 4 + color, so 0..15.
 */

export const SIZE = 4;
export const CELLS = SIZE * SIZE;
export const ALL = 0b1111; // a 4-bit set with every number (or color)
export const ALL_PAIRS = 0xffff; // a 16-bit set with every pair

export const rowOf = (cell: number) => Math.floor(cell / SIZE);
export const colOf = (cell: number) => cell % SIZE;
export const cellAt = (row: number, col: number) => row * SIZE + col;

export const pairOf = (num: number, color: number) => num * SIZE + color;
export const pairNum = (pair: number) => Math.floor(pair / SIZE);
export const pairColor = (pair: number) => pair % SIZE;

/** The 4 tiles of a row or a column. */
export interface Line {
	kind: 'row' | 'col';
	index: number;
	cells: number[];
}

export const LINES: Line[] = [
	...[0, 1, 2, 3].map((r) => ({ kind: 'row' as const, index: r, cells: [0, 1, 2, 3].map((c) => cellAt(r, c)) })),
	...[0, 1, 2, 3].map((c) => ({ kind: 'col' as const, index: c, cells: [0, 1, 2, 3].map((r) => cellAt(r, c)) })),
];

/** The other tiles that share a row or a column with this tile (6 tiles). */
export const PEERS: number[][] = Array.from({ length: CELLS }, (_, cell) =>
	Array.from({ length: CELLS }, (_, other) => other).filter(
		(other) => other !== cell && (rowOf(other) === rowOf(cell) || colOf(other) === colOf(cell)),
	),
);

export const bitCount = (mask: number) => {
	let n = 0;
	for (let m = mask; m; m &= m - 1) n++;
	return n;
};

/** The values in a bit set, lowest first. */
export const bits = (mask: number) => {
	const out: number[] = [];
	for (let v = 0; mask >> v; v++) if (mask & (1 << v)) out.push(v);
	return out;
};

export const onlyBit = (mask: number) => (bitCount(mask) === 1 ? Math.log2(mask) : -1);

/** Tile name as the player sees it: columns A..D, rows 1..4. "B3" is column B, row 3. */
export const cellName = (cell: number) => 'ABCD'[colOf(cell)] + String(rowOf(cell) + 1);

export const lineName = (line: Line) => (line.kind === 'row' ? `row ${line.index + 1}` : `column ${'ABCD'[line.index]}`);
