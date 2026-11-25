// Dev only: with ?drive in the URL, frames run only when a test script calls window.__pump().
// Lets play-tests run in a hidden browser tab. Must load before KAPLAY starts its loop.

if (import.meta.env.DEV && new URLSearchParams(location.search).has('drive')) {
	// The test tab is often hidden; KAPLAY stops time when it is. Pretend it is visible.
	Object.defineProperty(document, 'hidden', { get: () => false });
	Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
	document.addEventListener('visibilitychange', (e) => e.stopImmediatePropagation(), true);
	const queue: FrameRequestCallback[] = [];
	let now = performance.now();
	window.requestAnimationFrame = (cb) => {
		queue.push(cb);
		return queue.length;
	};
	(window as unknown as { __pump: (frames?: number, ms?: number) => void }).__pump = (frames = 1, ms = 1000 / 60) => {
		for (let i = 0; i < frames; i++) {
			now += ms;
			for (const cb of queue.splice(0)) cb(now);
		}
	};
	// Draws one frame and saves the canvas, with the DOM boxes outlined, to .shots/<name>.jpg.
	(window as unknown as { __shot: (name: string) => Promise<string> }).__shot = async (name: string) => {
		const pump = (window as unknown as { __pump: (n: number) => void }).__pump;
		pump(1);
		const src = document.querySelector<HTMLCanvasElement>('#game')!;
		const out = document.createElement('canvas');
		out.width = window.innerWidth;
		out.height = window.innerHeight;
		const g = out.getContext('2d')!;
		g.drawImage(src, 0, 0, out.width, out.height);
		// Sketch the overlay: each panel, card, button and bar as a box with its text.
		g.font = '11px sans-serif';
		for (const el of document.querySelectorAll<HTMLElement>('#ui .panel, #ui .card, #ui .btn, #ui .chip, #ui .bar, #ui .banner, #ui .coach, #ui .logo, #ui .combo-label, #ui .slot')) {
			const r = el.getBoundingClientRect();
			if (!r.width || el.closest('[hidden]')) continue;
			const cs = getComputedStyle(el);
			g.fillStyle = cs.backgroundColor;
			g.globalAlpha = 0.92;
			g.fillRect(r.x, r.y, r.width, r.height);
			g.globalAlpha = 1;
			g.strokeStyle = '#000';
			g.lineWidth = 2;
			g.strokeRect(r.x, r.y, r.width, r.height);
			if (!el.querySelector('.card, .btn, .chip, .bar')) {
				g.fillStyle = cs.color;
				const words = (el.innerText || '').replace(/\s+/g, ' ').trim();
				let line = '';
				let y = r.y + 13;
				for (const w of words.split(' ')) {
					if (g.measureText(line + w).width > r.width - 8 && line) {
						g.fillText(line, r.x + 4, y);
						line = '';
						y += 13;
						if (y > r.y + r.height) break;
					}
					line += w + ' ';
				}
				if (y <= r.y + r.height) g.fillText(line, r.x + 4, y);
			}
		}
		await fetch('/__shot', { method: 'POST', body: JSON.stringify({ name, data: out.toDataURL('image/jpeg', 0.8) }) });
		return name;
	};
}

export {};
