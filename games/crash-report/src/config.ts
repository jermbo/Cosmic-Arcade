/**
 * Every tuning value of the game is here. Change a number to change the feel.
 * Distances are in metres, times in seconds, masses in tonnes.
 * A change here makes saved replays invalid, so they are dropped on load.
 */

export type VehicleKind = 'car' | 'van' | 'bus' | 'tanker';

export interface VehicleSpec {
	/** Width, height and length of the body. */
	size: [number, number, number];
	mass: number;
	/** Money for the first hit on this vehicle, before the multiplier. */
	value: number;
	/** A bonus vehicle counts for the bonus goals and shows a bigger pop-up. */
	bonus: boolean;
	/** True when the vehicle blows up a short time after it is wrecked. */
	explodes: boolean;
	label: string;
}

export const CONFIG = {
	physics: {
		/** Fixed time step of the simulation. */
		step: 1 / 60,
		gravity: -18,
		/** Most steps the game runs in one frame, to stay safe after a long frame. */
		maxStepsPerFrame: 5,
		friction: 0.55,
		restitution: 0.18,
		wreckLinearDamping: 0.35,
		wreckAngularDamping: 0.6,
	},

	vehicles: {
		car: { size: [1.8, 1.25, 4.2], mass: 1.2, value: 1000, bonus: false, explodes: false, label: 'Car' },
		van: { size: [2.0, 2.0, 5.2], mass: 2.2, value: 1500, bonus: false, explodes: false, label: 'Van' },
		bus: { size: [2.5, 3.0, 10.5], mass: 6.5, value: 6000, bonus: true, explodes: false, label: 'Bus' },
		tanker: { size: [2.5, 3.0, 11.5], mass: 7.5, value: 8000, bonus: true, explodes: true, label: 'Tanker' },
	} satisfies Record<VehicleKind, VehicleSpec> as Record<VehicleKind, VehicleSpec>,

	player: {
		size: [1.9, 1.2, 4.4] as [number, number, number],
		mass: 2.4,
		/** How fast the car reaches the launch speed. */
		launchAccel: 60,
		/** Steering during the drive in, in degrees per second. */
		steerRate: 32,
		/** The drive in ends after this time even with no hit. */
		approachMaxTime: 5,
	},

	aim: {
		/** Aim speed with keys or a stick, in degrees per second. */
		keyRate: 40,
	},

	traffic: {
		laneWidth: 3.6,
		accel: 7,
		brake: 14,
		/** Gap that a car keeps to the car in front when both are stopped. */
		minGap: 2.2,
		/** How hard a car is pulled back to the centre of its lane. */
		laneHold: 5,
	},

	damage: {
		/** Contact force that wrecks a vehicle. Below it, the hit is ignored. */
		wreckForce: 55,
		/** Contact force that counts as the first hit of the player car. */
		playerHitForce: 25,
		/** Contact force that sets off a barrel. */
		barrelForce: 30,
		/** Contact force of a "big" hit: it gives a hit pause and more debris. */
		bigForce: 520,
		/** Extra money for a hard hit on a wreck: force times this value. */
		impactMoneyPerForce: 0.5,
		/** Shortest time between two paid impacts on the same vehicle. */
		impactCooldown: 0.5,
		/** Most money one extra impact can pay, before the multiplier. */
		impactMoneyMax: 600,
	},

	score: {
		/** A new wreck must come within this time to keep the chain. */
		chainWindow: 2.6,
		maxMultiplier: 12,
		barrelValue: 2500,
		/** Money for each vehicle that the Crashbreaker blast throws. */
		breakerBonus: 500,
	},

	aftertouch: {
		/** Seconds of real time in the meter. It does not refill. */
		meter: 3.2,
		timeScale: 0.22,
		/** Push on the car, as acceleration in m/s². */
		accel: 95,
		/** Small spin added by the push, so the car reacts. */
		spin: 2.5,
	},

	breaker: {
		radius: 17,
		/** Speed change of a 1 tonne body at the centre of the blast. */
		impulse: 30,
		lift: 0.55,
		/** Upward speed that the player car gets. */
		selfJump: 13,
	},

	barrel: {
		radius: 9,
		impulse: 17,
		lift: 0.6,
		mass: 0.25,
		/** Delay of a barrel that another blast sets off: base plus per metre. */
		fuseBase: 0.1,
		fusePerMetre: 0.022,
	},

	tanker: {
		radius: 14,
		impulse: 26,
		lift: 0.6,
		fuse: 0.7,
	},

	run: {
		/** The run ends this long after the last hit. */
		settleTime: 3.6,
		/** The warning bar shows for this long before the end. */
		settleWarn: 2.4,
		/** Wait between the end of the run and the results screen. */
		resultsDelay: 1.3,
		/** A body below this height is out of the world. */
		killY: -12,
	},

	feel: {
		hitPause: 0.075,
		bigHitPause: 0.13,
		hitPauseCooldown: 0.4,
		/** Slow motion at the first impact. */
		impactTimeScale: 0.16,
		impactCamTime: 1.25,
		/** Slow motion after a blast. */
		blastTimeScale: 0.3,
		blastSlowTime: 0.5,
		shakeDecay: 1.7,
		shakeMax: 1.1,
		shakeAngle: 0.035,
	},

	camera: {
		fov: 55,
		approachFov: 72,
		aimBack: 17,
		aimHeight: 14,
		aimLookAhead: 36,
		chaseBack: 8.5,
		chaseHeight: 3.4,
		crashRadius: 25,
		crashHeight: 14,
		/** Orbit speed of the crash camera, in radians per second. */
		orbitSpeed: 0.16,
		/** Angle that the camera swings at the first impact, in radians. */
		impactSwing: 1.5,
		impactRadius: 13,
		impactHeight: 4.5,
	},

	audio: {
		master: 0.8,
		sfx: 0.9,
		music: 0.5,
	},
};

export type Config = typeof CONFIG;
