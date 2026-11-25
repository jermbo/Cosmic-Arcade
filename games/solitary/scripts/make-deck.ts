// Makes the 1x deck sheet from the 4x Pixel Plebes sheet: one source pixel per art pixel.
// Run: node scripts/make-deck.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';

const SRC = 'src/assets/Plebes_CLASSIC_4XSheet.png';
const OUT = 'src/assets/plebes-1x.png';
const SCALE = 4;

const buf = readFileSync(SRC);
let pos = 8;
let width = 0, height = 0;
const idat: Buffer[] = [];
while (pos < buf.length) {
	const len = buf.readUInt32BE(pos);
	const type = buf.toString('ascii', pos + 4, pos + 8);
	const data = buf.subarray(pos + 8, pos + 8 + len);
	if (type === 'IHDR') {
		width = data.readUInt32BE(0);
		height = data.readUInt32BE(4);
		if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0) throw new Error('needs 8-bit RGBA, not interlaced');
	}
	if (type === 'IDAT') idat.push(data);
	pos += 12 + len;
}
const raw = inflateSync(Buffer.concat(idat));
const bpp = 4;
const stride = width * bpp;
const px = Buffer.alloc(stride * height);
for (let y = 0; y < height; y++) {
	const f = raw[y * (stride + 1)];
	const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
	for (let x = 0; x < stride; x++) {
		const a = x >= bpp ? px[y * stride + x - bpp] : 0;
		const b = y > 0 ? px[(y - 1) * stride + x] : 0;
		const c = x >= bpp && y > 0 ? px[(y - 1) * stride + x - bpp] : 0;
		let v = line[x];
		if (f === 1) v += a;
		else if (f === 2) v += b;
		else if (f === 3) v += (a + b) >> 1;
		else if (f === 4) {
			const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
			v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
		}
		px[y * stride + x] = v & 255;
	}
}
const W = width / SCALE, H = height / SCALE;
const out = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) {
	out[y * (W * 4 + 1)] = 0;
	for (let x = 0; x < W; x++) {
		const s = ((y * SCALE + 2) * width + (x * SCALE + 2)) * 4;
		px.copy(out, y * (W * 4 + 1) + 1 + x * 4, s, s + 4);
	}
}
const crcTable = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});
const crc = (b: Buffer) => {
	let c = 0xffffffff;
	for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, data: Buffer) => {
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length);
	const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
	const c = Buffer.alloc(4);
	c.writeUInt32BE(crc(td));
	return Buffer.concat([len, td, c]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([
	Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
	chunk('IHDR', ihdr),
	chunk('IDAT', deflateSync(out, { level: 9 })),
	chunk('IEND', Buffer.alloc(0)),
]);
writeFileSync(OUT, png);
console.log(`Wrote ${OUT}: ${W}x${H}, ${png.length} bytes`);
