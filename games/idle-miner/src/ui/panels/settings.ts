// The settings panel: sound, motion, and the save.

import { exportSave, importSave } from '../../core/save.ts';
import { closePanel, openPanel } from '../modal.ts';
import { host } from './host.ts';

export function openSettings(fromTitle = false) {
	openPanel({
		id: 'settings',
		title: 'Settings',
		still: true,
		render: () => {
			const s = host.game().settings;
			const save = fromTitle
				? ''
				: `<h3>Save</h3><p>The game saves by itself every few seconds on this device.</p>
				<div class="menu-list">
					<button class="btn btn--ghost" data-act="save-now">Save now</button>
					<button class="btn btn--ghost" data-act="export">Copy a save code</button>
					<textarea class="save-code" id="save-code" placeholder="Paste a save code here" aria-label="Save code"></textarea>
					<button class="btn btn--ghost" data-act="import">Load the save code</button>
					<button class="btn btn--danger" data-act="reset">Erase all progress</button>
				</div>`;
			return `<div class="setting"><label for="set-sfx">Sound effects</label><input id="set-sfx" type="range" min="0" max="1" step="0.05" value="${s.sfx}" data-act="sfx"></div>
				<div class="setting"><label for="set-music">Music</label><input id="set-music" type="range" min="0" max="1" step="0.05" value="${s.music}" data-act="music"></div>
				<div class="setting"><label for="set-vib">Vibration on tap</label><input id="set-vib" type="checkbox" ${s.vibrate ? 'checked' : ''} data-act="vibrate"></div>
				<div class="setting"><label for="set-rm">Less motion</label><input id="set-rm" type="checkbox" ${s.reduceMotion ? 'checked' : ''} data-act="motion"></div>
				${save}`;
		},
		act: (name, el) => {
			const g = host.game();
			const s = g.settings;
			const input = el as HTMLInputElement;
			switch (name) {
				case 'sfx':
					s.sfx = Number(input.value);
					break;
				case 'music':
					s.music = Number(input.value);
					break;
				case 'vibrate':
					s.vibrate = input.checked;
					break;
				case 'motion':
					s.reduceMotion = input.checked;
					break;
				case 'save-now':
					host.save();
					host.toast('Game saved');
					break;
				case 'export': {
					const code = exportSave(g);
					const box = document.getElementById('save-code') as HTMLTextAreaElement;
					box.value = code;
					box.select();
					navigator.clipboard?.writeText(code).then(
						() => host.toast('Save code copied'),
						() => host.toast('Select the code and copy it'),
					);
					break;
				}
				case 'import': {
					const box = document.getElementById('save-code') as HTMLTextAreaElement;
					const loaded = importSave(box.value);
					if (!loaded) {
						host.toast('That code did not work', 'warn');
						host.sound('error');
						return;
					}
					closePanel();
					host.loadGame(loaded);
					host.toast('Save loaded');
					break;
				}
				case 'reset':
					confirmReset();
					return;
			}
			host.settingsChanged();
		},
	});
}

function confirmReset() {
	openPanel({
		id: 'reset',
		title: 'Erase everything?',
		render: () => `<p>This deletes your save on this device: planets, stardust, perks and stats. It cannot be undone.</p><div class="card__row"><button class="btn btn--ghost" data-act="no">Keep my save</button><button class="btn btn--danger" data-act="yes">Erase</button></div>`,
		act: (name) => {
			if (name === 'no') openSettings();
			if (name === 'yes') {
				closePanel();
				host.resetAll();
			}
		},
	});
}
