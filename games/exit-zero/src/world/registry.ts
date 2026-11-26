import type { EntityDef } from '../core/types.ts';
import type { Component, World } from './world.ts';

export type Factory = (def: EntityDef, world: World) => Component;

/** Entity type name -> factory. Add a puzzle type by registering a new factory. */
export const registry: Record<string, Factory> = {};

export function register(type: string, factory: Factory): void {
	registry[type] = factory;
}

export function spawn(def: EntityDef, world: World): Component | null {
	const f = registry[def.type];
	if (!f) {
		console.warn(`No component for entity type "${def.type}" (${def.id})`);
		return null;
	}
	const c = f(def, world);
	world.components.push(c);
	return c;
}
