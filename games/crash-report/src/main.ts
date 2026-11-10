import './style.css';
import { Game } from './game.ts';
import { initPhysics } from './sim/sim.ts';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const loading = document.getElementById('loading');

initPhysics()
	.then(() => {
		const game = new Game(canvas);
		game.start();
		loading?.remove();
		if (import.meta.env.DEV) (window as unknown as { game: Game }).game = game;
	})
	.catch((error: unknown) => {
		console.error(error);
		if (loading) loading.textContent = 'The game could not start. Please reload the page.';
	});
