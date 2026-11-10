// Short number text: 1.2K, 3.4M, and so on.

const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

export function fmt(n: number): string {
	if (!isFinite(n)) return '∞';
	const neg = n < 0;
	let v = Math.abs(n);
	if (v < 1000) {
		const s = v < 10 && v % 1 !== 0 ? v.toFixed(1).replace(/\.0$/, '') : Math.floor(v).toString();
		return (neg ? '-' : '') + s;
	}
	let u = 0;
	while (v >= 1000 && u < UNITS.length - 1) {
		v /= 1000;
		u++;
	}
	if (v >= 1000) return (neg ? '-' : '') + n.toExponential(2).replace('+', '');
	let s = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
	// Strip trailing fractional zeros (1.20 → 1.2), not integer digits (600 → 6).
	if (s.includes('.')) s = s.replace(/\.?0+$/, '');
	return (neg ? '-' : '') + s + UNITS[u];
}

export function fmtTime(seconds: number): string {
	const s = Math.floor(seconds);
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}m ${s % 60}s`;
	const h = Math.floor(m / 60);
	return `${h}h ${m % 60}m`;
}
