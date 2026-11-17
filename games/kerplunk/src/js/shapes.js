// The piece shapes, drawn in ASCII: '#' is a block, '.' is empty. Pieces never turn, so every form is listed.
// A piece moves as one rigid shape: it rises until any block touches the ceiling or a stack, and it only
// fits if the whole shape fits. Blocks left with a gap above them then rise to close it.
// A higher weight shows up more often. Big shapes get weight 1 so they stay a surprise.
//
// The secret shape lab (shape-lab.html) edits this list and can copy it back here.

export const SHAPE_ART = [
	// Threes
	{ weight: 3, art: ['###'] },
	{ weight: 3, art: ['#', '#', '#'] },
	{ weight: 3, art: ['##', '#.'] },
	{ weight: 3, art: ['##', '.#'] },
	{ weight: 3, art: ['#.', '##'] },
	{ weight: 3, art: ['.#', '##'] },
	// Twos
	{ weight: 2, art: ['##'] },
	{ weight: 2, art: ['#', '#'] },
	// Fours
	{ weight: 3, art: ['##', '##'] },
	{ weight: 3, art: ['###', '.#.'] },
	{ weight: 3, art: ['.##', '##.'] },
	{ weight: 3, art: ['##.', '.##'] },
	{ weight: 2, art: ['####'] },
	{ weight: 2, art: ['#', '#', '#', '#'] },
	{ weight: 2, art: ['#.', '#.', '##'] },
	{ weight: 2, art: ['.#', '.#', '##'] },
	{ weight: 2, art: ['###', '#..'] },
	{ weight: 2, art: ['###', '..#'] },
	// Fives and bigger
	{ weight: 1, art: ['#####'] },
	{ weight: 1, art: ['.#.', '###', '.#.'] },
	{ weight: 1, art: ['#.#', '###'] },
	{ weight: 1, art: ['..#', '.##', '##.'] },
	{ weight: 1, art: ['##', '##', '#.'] },
	{ weight: 1, art: ['#..', '#..', '###'] },
	{ weight: 1, art: ['##.', '.#.', '.##'] },
	{ weight: 1, art: ['#...#', '.###.'] },
	{ weight: 1, art: ['####.', '.####'] },
	{ weight: 1, art: ['..#..', '.###.', '#####'] },
];
