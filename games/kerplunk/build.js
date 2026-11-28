// The game is plain static files, so the build copies the cozy kit in, then copies src/ to dist/.
import { cpSync, rmSync } from 'node:fs';
import './tools/copy-kit.js';

rmSync('dist', { recursive: true, force: true });
cpSync('src', 'dist', { recursive: true });
