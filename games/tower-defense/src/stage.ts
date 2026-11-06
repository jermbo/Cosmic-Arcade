import * as THREE from 'three';

/** The renderer, the camera and the light. Fits the board to the screen and shakes on hits. */
export class Stage {
	readonly renderer: THREE.WebGLRenderer;
	readonly scene = new THREE.Scene();
	readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
	readonly sun = new THREE.DirectionalLight(0xfff3e0, 2.4);
	shakeEnabled = true;
	/** Turns the camera around the board. The title screen sets it straight; play uses turn(). */
	yaw = 0;
	/** Space kept free for the HUD, as fractions of the screen. */
	margins = { top: 0.12, bottom: 0.14, left: 0.03, right: 0.03 };

	private readonly target = new THREE.Vector3();
	private distance = 20;
	private boardSize = new THREE.Vector2(10, 10);
	private shake = 0;
	private readonly tilt = THREE.MathUtils.degToRad(54);
	private yawGoal: number | null = null;
	private readonly sunOffset = new THREE.Vector3(-6, 14, 8);

	constructor(canvas: HTMLCanvasElement) {
		this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
		this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFShadowMap;
		this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
		this.renderer.toneMappingExposure = 1.05;

		const sky = new THREE.HemisphereLight(0xe6f0ff, 0x6a4f7a, 1.5);
		this.scene.add(sky);
		this.sun.position.copy(this.sunOffset);
		this.sun.castShadow = true;
		this.sun.shadow.mapSize.set(2048, 2048);
		this.sun.shadow.bias = -0.0005;
		this.sun.shadow.normalBias = 0.02;
		const box = this.sun.shadow.camera;
		box.left = -14;
		box.right = 14;
		box.top = 14;
		box.bottom = -14;
		box.near = 1;
		box.far = 50;
		this.scene.add(this.sun, this.sun.target);
		this.resize();
	}

	setBoard(width: number, depth: number): void {
		this.boardSize.set(width, depth);
		this.fit();
	}

	/** Turns the board a quarter turn left (-1) or right (1), with a smooth swing. */
	turn(steps: number): void {
		const quarter = Math.PI / 2;
		const from = this.yawGoal ?? this.yaw;
		this.yawGoal = Math.round(from / quarter) * quarter + steps * quarter;
	}

	/** Turns to an exact angle at once, for dragging. */
	turnTo(yaw: number): void {
		this.yawGoal = null;
		this.yaw = yaw;
		this.fit();
	}

	/** Sets the turn at once, in quarter turns. */
	setQuarter(quarter: number): void {
		this.yawGoal = null;
		this.yaw = quarter * (Math.PI / 2);
		this.fit();
	}

	/** The current turn in quarter turns, 0 to 3. */
	get quarter(): number {
		const q = Math.round((this.yawGoal ?? this.yaw) / (Math.PI / 2));
		return ((q % 4) + 4) % 4;
	}

	get turning(): boolean {
		return this.yawGoal !== null;
	}

	addShake(amount: number): void {
		if (!this.shakeEnabled) return;
		this.shake = Math.min(0.35, this.shake + amount);
	}

	resize(): void {
		const canvas = this.renderer.domElement;
		const width = canvas.clientWidth || innerWidth;
		const height = canvas.clientHeight || innerHeight;
		this.renderer.setSize(width, height, false);
		this.camera.aspect = width / height;
		this.camera.updateProjectionMatrix();
		this.fit();
	}

	/** Finds the camera distance and aim that make the whole board fit inside the margins. */
	fit(): void {
		const { x: w, y: d } = this.boardSize;
		const corners: THREE.Vector3[] = [];
		for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) for (const y of [-0.8, 1.2]) corners.push(new THREE.Vector3(x, y, z));
		const m = this.margins;
		const fits = (): { ok: boolean; mid: number } => {
			this.place(0);
			this.camera.updateMatrixWorld();
			let minY = Infinity;
			let maxY = -Infinity;
			let ok = true;
			const p = new THREE.Vector3();
			for (const corner of corners) {
				p.copy(corner).project(this.camera);
				minY = Math.min(minY, p.y);
				maxY = Math.max(maxY, p.y);
				if (p.x < -1 + m.left * 2 || p.x > 1 - m.right * 2) ok = false;
			}
			const span = 2 - (m.top + m.bottom) * 2;
			if (maxY - minY > span) ok = false;
			return { ok, mid: (minY + maxY) / 2 };
		};
		this.target.set(0, 0, 0);
		// Moving the aim along this ground direction moves the board up and down the screen.
		const back = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
		let low = 4;
		let high = 80;
		for (let i = 0; i < 24; i++) {
			this.distance = (low + high) / 2;
			if (fits().ok) high = this.distance;
			else low = this.distance;
		}
		this.distance = high;
		// Move the aim so the board sits in the middle of the free space.
		for (let i = 0; i < 4; i++) {
			const { mid } = fits();
			const wanted = m.bottom - m.top;
			const worldPerNdc = (Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.distance) / Math.sin(this.tilt);
			this.target.addScaledVector(back, (wanted - mid) * worldPerNdc);
		}
		this.place(0);
	}

	private place(dt: number): void {
		const sunTurn = this.sunOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
		this.sun.position.copy(sunTurn);
		const offset = new THREE.Vector3(0, Math.sin(this.tilt), Math.cos(this.tilt)).multiplyScalar(this.distance);
		offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
		this.camera.position.copy(this.target).add(offset);
		this.camera.lookAt(this.target);
		if (this.shake > 0.001) {
			const s = this.shake;
			this.camera.position.x += (Math.random() - 0.5) * s;
			this.camera.position.y += (Math.random() - 0.5) * s;
			this.camera.position.z += (Math.random() - 0.5) * s;
			this.shake = Math.max(0, this.shake - dt * 1.4);
		}
	}

	render(dt: number): void {
		if (this.yawGoal !== null) {
			// Ease toward the goal and keep the whole board in view on the way.
			const diff = this.yawGoal - this.yaw;
			if (Math.abs(diff) < 0.002) {
				this.yaw = this.yawGoal;
				this.yawGoal = null;
			} else this.yaw += diff * (1 - Math.exp(-dt * 9));
			this.fit();
		}
		this.place(dt);
		this.renderer.render(this.scene, this.camera);
	}

	/** Screen position in CSS pixels of a world point. */
	toScreen(point: THREE.Vector3, out = new THREE.Vector2()): THREE.Vector2 {
		const p = point.clone().project(this.camera);
		const canvas = this.renderer.domElement;
		return out.set(((p.x + 1) / 2) * canvas.clientWidth, ((1 - p.y) / 2) * canvas.clientHeight);
	}

	/** The point on the ground under a screen position in CSS pixels. */
	pick(x: number, y: number): THREE.Vector3 | null {
		const canvas = this.renderer.domElement;
		const ndc = new THREE.Vector2((x / canvas.clientWidth) * 2 - 1, -(y / canvas.clientHeight) * 2 + 1);
		const ray = new THREE.Raycaster();
		ray.setFromCamera(ndc, this.camera);
		const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.2);
		const hit = new THREE.Vector3();
		return ray.ray.intersectPlane(plane, hit);
	}
}
