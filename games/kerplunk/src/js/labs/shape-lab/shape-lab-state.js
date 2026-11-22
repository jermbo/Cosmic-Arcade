// The state of the shape lab: the list being edited, which shape is picked, and the block colors.

import { cleanShapes } from '../../rules/shapes/shape-list.js';
import { SHAPE_ART } from '../../rules/shapes/shape-art.js';
import { loadCustomShapes } from '../../app/storage.js';

export const copyShapes = (list) => list.map(({ weight, art }) => ({ weight, art: art.slice() }));

const savedShapes = cleanShapes(loadCustomShapes());
const startList = savedShapes.length ? savedShapes : SHAPE_ART;

export const lab = {
	shapes: copyShapes(startList),
	baseline: JSON.stringify(startList), // the list as saved: a change from it shows the "not saved" mark
	selected: 0,
	colorSeed: 3, // the Colors button changes it, to color the blocks another way
};

/** The shape being edited. */
export const currentShape = () => lab.shapes[lab.selected];

/** A color for the block at (x, y), mixed so neighbors usually differ. */
export const colorAt = (x, y) => (x * 7 + y * 13 + lab.colorSeed) % 5;

export const totalWeight = () => lab.shapes.reduce((sum, shape) => sum + shape.weight, 0);

/** How often a shape shows up, as a percent text. */
export const chanceOf = (shape) => `${((shape.weight / totalWeight()) * 100).toFixed(1)}%`;

export const hasChanges = () => JSON.stringify(lab.shapes) !== lab.baseline;
