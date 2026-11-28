/// <reference lib="webworker" />
/** The bots think here, off the main thread, so the flips stay smooth. */
import type { BotId } from './bot.ts';
import { pickMove } from './bot.ts';
import type { Side } from './rules.ts';

export interface BotAsk {
	id: number;
	cells: number[];
	n: number;
	side: Side;
	bot: BotId;
}

export interface BotAnswer {
	id: number;
	move: number;
}

self.onmessage = (e: MessageEvent<BotAsk>) => {
	const { id, cells, n, side, bot } = e.data;
	const answer: BotAnswer = { id, move: pickMove(cells, n, side, bot) };
	self.postMessage(answer);
};
