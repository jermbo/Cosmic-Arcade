// Builds src/data/dict.txt, the list of words a guess may be.
// Source: the system word list (Webster's 2nd, public domain) at /usr/share/dict/words.
// Run with `npm run dict`. The game also adds every word in the group bank and in extra-words.txt.
import { readFileSync, writeFileSync } from 'node:fs';

const source = readFileSync('/usr/share/dict/words', 'utf8').split('\n');
const words = new Set<string>();
for (const line of source) {
	const w = line.trim();
	if (/^[a-z]{3,8}$/.test(w)) words.add(w.toUpperCase());
}
const out = [...words].sort().join('\n');
writeFileSync('src/data/dict.txt', out + '\n');
console.log(`dict.txt: ${words.size} words, ${(out.length / 1024).toFixed(0)} kB`);
