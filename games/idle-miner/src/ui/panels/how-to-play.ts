// The how-to-play panel.

import { closePanel, openPanel } from '../modal.ts';

export function openHow() {
	openPanel({
		id: 'how',
		title: 'How to play',
		render: () => `<ul class="how">
			<li><b>Tap a planet</b> on the space map to mine by hand.</li>
			<li><b>Open a planet</b> and pick a tool. Put <b>drills</b> on glowing ore tiles.</li>
			<li><b>Drag</b> to lay belts. Belts point the way you drag. Drag from a drill to the <b>launch pad</b>.</li>
			<li>Put a <b>smelter</b> on the line to turn ore into bars. Bars sell for more. Items a machine cannot use pass straight through it.</li>
			<li><b>Rocks</b> block building. Research <b>Blast Charges</b>, then tap a rock with <b>Remove</b> to clear it.</li>
			<li>Research <b>Belt Bridges</b> to cross lines. Drag a belt straight across another belt to make a <b>crossing</b>. With the <b>Bridge</b> tool, drag from one end to the other to hop over up to 3 tiles.</li>
			<li><b>Tap a machine</b> to upgrade, turn or remove it. Tap a belt with the belt tool to turn it.</li>
			<li><b>Ships</b> fly cargo home. If the pad fills up, buy more ships or cargo space.</li>
			<li><b>Crew</b> boost the planet they work on. Hire them once and keep them for good. Stardust buys more crew slots.</li>
			<li>Follow the <b>Next</b> bar at the top when you are not sure what to do.</li>
			<li>The game keeps working while you are away, up to a time limit.</li>
			<li>Keys: <b>1–9</b> tools, <b>0</b> remove, <b>R</b> turn, <b>Del</b> remove, <b>Esc</b> back, <b>Tab</b> map / planet.</li>
		</ul><button class="btn" style="width:100%" data-act="ok">Got it</button>`,
		act: (name) => name === 'ok' && closePanel(),
	});
}
