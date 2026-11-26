import type { Action, Cond } from '../../core/types.ts';
import { Builder } from '../../render/builder.ts';
import { PICKUPS } from '../../render/models.ts';
import { register } from '../registry.ts';
import type { Interaction } from '../world.ts';
import { DEG, setHighlight, syncAmbient } from './util.ts';
import notes from '../../data/notes.json';
import { FACING } from '../world.ts';
import type { Facing } from '../../core/types.ts';

// A thing to pick up: an item, a note, or both.

register('pickup', (def, world) => {
	const { state, host } = world;
	const b = new Builder();
	(PICKUPS[def.model as string] ?? PICKUPS.note)(b);
	const { group, materials } = b.build({ dynamic: true });
	const wall = def.wall as Facing | undefined;
	const base = wall ? world.wallPoint({ ...def, facing: wall }, (def.y as number) ?? 1.1, 0.01) : world.pos(def.at, (def.y as number) ?? 0.01);
	group.position.copy(base);
	if (wall) group.rotation.set(Math.PI / 2, -FACING[wall], 0, 'YXZ');
	else group.rotation.y = -((def.rot as number) ?? 0) * DEG;
	world.root.add(group);

	const item = def.item as string | undefined;
	const note = def.note as string | undefined;
	const spins = !!item;
	const gotFlag = `got.${def.id}`;
	let hovered = false;

	const visible = () => !state.flag(gotFlag) && state.check(def.when as Cond | undefined);

	const pick = () => {
		state.setFlag(gotFlag);
		if (item) {
			state.give(item);
			host.say(`+ ${host.itemName(item)}`);
			host.sound('pickup');
		}
		if (note) {
			state.addNote(note);
			host.sound('paper');
			host.readNote(note);
		}
		host.run(def.onPick as Action[] | undefined);
		group.visible = false;
	};

	const label = () => {
		if (item) return `${host.t('prompt.pickup')} ${host.itemName(item)}`;
		const n = (notes as Record<string, { title: string }>)[note ?? ''];
		return `${host.t('prompt.read')}: ${n?.title ?? 'note'}`;
	};

	const point = base.clone();
	if (!wall) point.y += 0.05;

	return {
		def,
		sync() {
			group.visible = visible();
		},
		update(dt, t) {
			group.visible = visible();
			if (!group.visible) return;
			syncAmbient(world, base, materials, 1.25);
			if (spins) {
				group.position.y = base.y + 0.05 + Math.sin(t * 2.2) * 0.02;
				group.rotation.y += dt * 0.7;
			}
			// a soft glint, so small things read in dim rooms
			const glint = spins ? 0.06 + Math.max(0, Math.sin(t * 3)) * 0.08 : 0.04;
			setHighlight(materials, hovered ? 0.28 : glint);
			hovered = false;
		},
		interactions(): Interaction[] {
			if (!visible()) return [];
			return [{ pos: point, label: label(), use: pick, range: 2.3, onHover: () => (hovered = true) }];
		},
	};
});
