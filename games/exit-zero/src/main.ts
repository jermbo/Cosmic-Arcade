import '@fontsource/pixelify-sans/latin-400.css';
import '@fontsource/pixelify-sans/latin-700.css';
import '@fontsource/dm-mono/latin-400.css';
import '@fontsource/dm-mono/latin-500.css';
import './style.css';
import { Game } from './game.ts';

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const ui = document.querySelector<HTMLElement>('#ui')!;
const game = new Game(canvas, ui);

if (import.meta.env.DEV) (window as unknown as { exit0: Game }).exit0 = game;
