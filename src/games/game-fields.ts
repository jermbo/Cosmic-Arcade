export const GAME_STATUSES = ['idea', 'prototype', 'playable', 'released'] as const;
export const GAME_KINDS = ['video', 'tabletop'] as const;
export const PLATFORMS = ['desktop', 'mobile'] as const;
export const INPUTS = ['keyboard', 'mouse', 'touch', 'gamepad'] as const;

export type GameKind = (typeof GAME_KINDS)[number];

const KIND_LABELS: Record<GameKind, string> = {
	video: 'Browser game',
	tabletop: 'Tabletop game',
};

export function kindLabel(kind: GameKind): string {
	return KIND_LABELS[kind];
}
