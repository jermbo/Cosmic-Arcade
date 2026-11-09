export interface DaemonDef {
	id: string;
	name: string;
	maxHp: number;
	flavor: string;
	/** Key into the sigil art in ui/sigils.ts. */
	sigil: string;
}

export const DAEMONS: Record<string, DaemonDef> = {
	sentry: { id: 'sentry', name: 'SENTRY 4B', maxHp: 22, flavor: 'Perimeter scanner. Pings everything.', sigil: 'eye' },
	crawler: { id: 'crawler', name: 'CRAWLER', maxHp: 13, flavor: 'Cheap. Fast. Hungry.', sigil: 'legs' },
	lockjaw: { id: 'lockjaw', name: 'LOCKJAW', maxHp: 18, flavor: 'Bites a socket and holds.', sigil: 'jaw' },
	unknown_a: { id: 'unknown_a', name: '??? UNIT', maxHp: 20, flavor: 'Signature unreadable.', sigil: 'glitch' },
	unknown_b: { id: 'unknown_b', name: '??? UNIT', maxHp: 16, flavor: 'Signature unreadable.', sigil: 'glitch' },
	hunter: { id: 'hunter', name: 'HUNTER PRIME', maxHp: 44, flavor: 'Trace-hound. Follows noise.', sigil: 'hunter' },
	warden: { id: 'warden', name: 'NULL WARDEN', maxHp: 88, flavor: 'Root guardian. It does not sleep.', sigil: 'warden' },
};
