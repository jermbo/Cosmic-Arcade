// The crash panel: the game stopped after an error.

import { exportStoredSave } from '../../core/save.ts';
import { openPanel } from '../modal.ts';
import { host } from './host.ts';

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** The game hit an error and stopped. It no longer saves, so the last good save stays on disk. */
export function openCrash(errors: string[]) {
	const report = errors.join('\n');
	openPanel({
		id: 'crash',
		title: 'Something broke',
		locked: true,
		still: true,
		render: () => `<p>The game hit an error and stopped so it would not save a broken game. Your last save is safe.</p>
			<p>Copy your save code to keep a backup, then reload. If you are testing, please send the error below with your bug report.</p>
			<textarea class="save-code" id="crash-log" readonly aria-label="Error details">${escapeHtml(report)}</textarea>
			<div class="menu-list">
				<button class="btn btn--ghost" data-act="save">Copy save code</button>
				<button class="btn btn--ghost" data-act="log">Copy error</button>
				<button class="btn btn--gold" data-act="reload">Reload</button>
			</div>`,
		act: (name) => {
			const copy = (text: string, done: string) =>
				navigator.clipboard?.writeText(text).then(
					() => host.toast(done),
					() => host.toast('Could not copy. Select the text and copy it', 'warn'),
				);
			if (name === 'save') {
				const code = exportStoredSave();
				if (code) copy(code, 'Save code copied');
				else host.toast('No save found on this device', 'warn');
			}
			if (name === 'log') copy(report, 'Error copied');
			if (name === 'reload') location.reload();
		},
	});
}
