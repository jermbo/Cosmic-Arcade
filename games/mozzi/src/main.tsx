import '@arcade/cozy-kit/fonts.css';
import '@arcade/cozy-kit/kit.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import { App } from './ui/App.tsx';

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
