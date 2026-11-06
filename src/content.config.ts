import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { readGameProjects } from '../scripts/game-projects.js';
import { GAME_STATUSES, INPUTS, PLATFORMS } from './games/game-fields';

const gameProjects = readGameProjects();
const gameProjectIds = new Set(gameProjects.map((project) => project.id));

const builds = defineCollection({
	loader: () => gameProjects,
	schema: z.object({
		engine: z.string(),
		outDir: z.string(),
		folder: z.string(),
	}),
});

const sharedFields = {
	title: z.string(),
	tagline: z.string(),
	status: z.enum(GAME_STATUSES),
	tags: z.array(z.string()).default([]),
};

const videoGame = z
	.object({
		...sharedFields,
		kind: z.literal('video'),
		build: reference('builds').optional(),
		platforms: z.array(z.enum(PLATFORMS)).optional(),
		inputs: z.array(z.enum(INPUTS)).optional(),
	})
	.superRefine((game, context) => {
		if (!game.build || gameProjectIds.has(game.build.id)) return;
		context.addIssue({
			code: 'custom',
			message: `The build "${game.build.id}" names no game project in games/.`,
			path: ['build'],
		});
	})
	.refine((game) => !game.build || (game.platforms?.length && game.inputs?.length), {
		message: 'A video game with a build must give its platforms and inputs.',
		path: ['build'],
	});

const tabletopGame = z.strictObject({
	...sharedFields,
	kind: z.literal('tabletop'),
});

const games = defineCollection({
	loader: glob({ pattern: '*/index.md', base: './src/content/games' }),
	schema: z.discriminatedUnion('kind', [videoGame, tabletopGame]),
});

export const collections = { builds, games };
