// The animation styles the player can buy in the shop. A style is a set of motion numbers
// (see DEFAULT_TUNING.motion for what each one does). The first one ("Classic") changes nothing.

import { MOTION_PRICES } from '../shop/prices.js';

const style = (id, name, text, values) => ({ id, name, text, price: MOTION_PRICES[id], values });

export const MOTION_STYLES = [
	style('classic', 'Classic', 'A firm squash and a quick hop. The way Kerplunk moves.', {}),
	style('snappy', 'Snappy', 'Fast and crisp. Blocks rise quickly and clears are short.', {
		gravity: 110,
		dropSpeed: 8,
		landSquash: 0.22,
		squashSpring: 26,
		clearTime: 0.24,
		clearStagger: 0.022,
		hopSize: 2,
		fallSize: 12,
		stickerTime: 0.9,
		trayPop: 0.15,
	}),
	style('bouncy', 'Bouncy', 'Soft and springy. Blocks squish and wobble back.', {
		gravity: 60,
		landSquash: 0.46,
		settleSquash: 0.34,
		squashSpring: 8,
		hopSize: 7,
		clearGrow: 0.2,
		stickerPop: 0.35,
		trayPop: 0.4,
	}),
	style('heavy', 'Heavy', 'Big thumps and shakes. Cleared blocks drop like stones.', {
		gravity: 130,
		dropSpeed: 2,
		landSquash: 0.38,
		landShake: 4,
		chainShake: 6,
		blastShake: 14,
		shakeTime: 0.16,
		fallSize: 32,
		fallEase: 3,
		fallSpin: 0.1,
		clearGrow: 0.02,
	}),
	style('floaty', 'Floaty', 'Slow and dreamy. Blocks drift and twirl away.', {
		gravity: 28,
		dropSpeed: 2,
		landSquash: 0.15,
		squashSpring: 10,
		clearTime: 0.62,
		clearStagger: 0.06,
		hopPart: 0.45,
		hopSize: 6,
		fallSize: 10,
		fallEase: 1.4,
		fallSpin: 0.6,
		landShake: 0.5,
		stickerTime: 1.6,
		stickerRise: 1.4,
	}),
];

/** The style with this id. An unknown id gets the first (free) one. */
export const findMotion = (id) => MOTION_STYLES.find((item) => item.id === id) || MOTION_STYLES[0];
