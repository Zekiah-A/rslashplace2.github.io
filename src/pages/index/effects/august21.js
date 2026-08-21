import { disableAugust21ForToday } from "../august21-event.js";

const STATE_DURATION = 42_000;
const EFFECT_ID = "august21Effect";
const MOTION_KEY = "august21ReducedMotion";

const STATES = [
	{ id: "signal", label: "SIGNAL ACQUIRED", phrase: "ZUBIGRI WAS HERE", colour: "#00ffff" },
	{ id: "cyan", label: "CYAN LEAK", phrase: "CHAOS CHAOS CHAOS", colour: "#00ffff" },
	{ id: "sphere", label: "FALSE SPHERE", phrase: "THE CANVAS IS ROUND", colour: "#00ffff" },
	{ id: "fracture", label: "TRIANGULAR FAILURE", phrase: "∆  ∆∆", colour: "#00ffff" },
	{ id: "gold", label: "GOLD PROTOCOL", phrase: "LEGALISE NUCLEAR BOMBS", colour: "#ffd700" },
	{ id: "mad", label: "MAD.", phrase: "C42Ё!!!", colour: "#ffd700" },
	{ id: "recovery", label: "RECOVERY FAILED", phrase: "MORE SOON!!!", colour: "#00ffff" }
];

const TOKENS = [
	"42", "C42Ё!!!", "CHAOS CHAOS CHAOS", "Mad.", "ёж", "ЁЖ", "ZUBIGRI",
	"∆  ∆∆", "LEGALISE NUCLEAR BOMBS", "PROVE", "CALL SAUL?", "ACTUALLY CONNECTED?",
	"NO TIME", "APOCALYPSE!!!", "BY ZUBIGRI", "MORE SOON!!!", "GOLD", "#00FFFF",
	"9/11X", "1984X", "ANIMATION ILLUSION", "GOT ЁЖ?", "BUY IT", "DELETE :VIP? TOO LAZY",
	"THE BULLET? THE BULLET!", "ABSENCE OF PROOF", "LORE?", "ART.", "DIAGRAM IS CANON"
];

const STYLE = `
	#${EFFECT_ID} {
		--august21-colour: #00ffff;
		position: fixed;
		inset: 0;
		z-index: 6;
		pointer-events: none;
		isolation: isolate;
		font-family: mono, ui-monospace, monospace;
		color: var(--august21-colour);
	}
	#${EFFECT_ID} .august21-canvas,
	#${EFFECT_ID} .august21-diagram,
	#${EFFECT_ID} .august21-scanlines,
	#${EFFECT_ID} .august21-lens,
	#${EFFECT_ID} .august21-fractures {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
	#${EFFECT_ID} .august21-canvas {
		z-index: 2;
		mix-blend-mode: hard-light;
	}
	#${EFFECT_ID} .august21-diagram {
		z-index: 1;
		background: #000 url('/images/august21-ad.png') center / min(92vw, 1080px) auto no-repeat;
		opacity: 0;
		filter: sepia(1) saturate(7) hue-rotate(355deg) contrast(1.35);
		mix-blend-mode: screen;
		transition: opacity 1.2s ease;
	}
	#${EFFECT_ID} .august21-scanlines {
		z-index: 3;
		opacity: .16;
		background: repeating-linear-gradient(0deg, transparent 0 4px, #00ffff22 5px, #0008 6px);
		animation: august21Scan 9s linear infinite;
	}
	#${EFFECT_ID} .august21-lens {
		z-index: 1;
		inset: 8vh 12vw;
		width: auto;
		height: auto;
		border-radius: 50%;
		opacity: 0;
		box-shadow: inset 0 0 8vw #00ffff66, 0 0 8vw #00ffff44;
		backdrop-filter: saturate(2.2) contrast(1.35) hue-rotate(145deg);
		transition: opacity .8s ease;
	}
	#${EFFECT_ID} .august21-lens::before,
	#${EFFECT_ID} .august21-lens::after {
		content: "";
		position: absolute;
		inset: 7%;
		border: 2px solid #00ffff66;
		border-radius: 50%;
	}
	#${EFFECT_ID} .august21-lens::after { inset: 18%; border-style: dashed; }
	#${EFFECT_ID} .august21-fractures {
		z-index: 4;
		opacity: 0;
		transition: opacity .4s ease;
		background:
			linear-gradient(27deg, transparent 49.7%, #00ffffaa 50%, transparent 50.3%) 0 0 / 44% 100%,
			linear-gradient(153deg, transparent 49.7%, #ffd70099 50%, transparent 50.3%) 100% 0 / 58% 100%,
			linear-gradient(72deg, transparent 49.7%, #ffffff88 50%, transparent 50.3%) center / 100% 58%;
	}
	#${EFFECT_ID} .august21-fractures::before,
	#${EFFECT_ID} .august21-fractures::after {
		content: "";
		position: absolute;
		inset: 0;
		backdrop-filter: hue-rotate(165deg) saturate(2);
		clip-path: polygon(0 0, 42% 0, 55% 51%, 20% 72%);
	}
	#${EFFECT_ID} .august21-fractures::after {
		backdrop-filter: invert(.16) contrast(1.6);
		clip-path: polygon(100% 0, 58% 0, 55% 51%, 83% 88%);
	}
	#${EFFECT_ID} .august21-status {
		position: absolute;
		top: 12px;
		left: 50%;
		z-index: 8;
		width: min(460px, calc(100vw - 24px));
		transform: translateX(-50%) rotate(-.35deg);
		box-sizing: border-box;
		border: 2px solid var(--august21-colour);
		border-radius: 2px;
		padding: 9px 11px 8px;
		background: #020707e8;
		box-shadow: 5px 5px 0 #000, 7px 7px 0 var(--august21-colour), 0 0 28px #00ffff44;
		pointer-events: auto;
		text-transform: uppercase;
	}
	#${EFFECT_ID} .august21-status::before {
		content: "CLIENT ANOMALY // 21.08 // LAW 42";
		display: block;
		font-size: 10px;
		letter-spacing: .17em;
		opacity: .72;
	}
	#${EFFECT_ID} .august21-status-row {
		display: flex;
		align-items: baseline;
		gap: 8px;
		margin: 4px 0 6px;
	}
	#${EFFECT_ID} .august21-code {
		font-size: clamp(24px, 5vw, 40px);
		line-height: .9;
		font-weight: 900;
		letter-spacing: -.08em;
		text-shadow: 2px 0 #ff003c, -2px 0 #00ffff;
	}
	#${EFFECT_ID} .august21-state-copy { min-width: 0; flex: 1; }
	#${EFFECT_ID} .august21-state-label {
		display: block;
		font-size: clamp(13px, 2.6vw, 18px);
		font-weight: 900;
		letter-spacing: .08em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	#${EFFECT_ID} .august21-phrase {
		display: block;
		color: #fff;
		font-size: 10px;
		letter-spacing: .14em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	#${EFFECT_ID} .august21-seconds {
		font-size: 22px;
		font-weight: 900;
		font-variant-numeric: tabular-nums;
	}
	#${EFFECT_ID} .august21-progress {
		height: 4px;
		margin: 0 0 7px;
		border: 1px solid currentColor;
		background: linear-gradient(90deg, var(--august21-colour) var(--august21-progress, 0%), transparent 0);
	}
	#${EFFECT_ID} .august21-controls { display: flex; gap: 6px; justify-content: flex-end; }
	#${EFFECT_ID} .august21-controls button {
		min-width: 0;
		border: 1px solid currentColor;
		border-radius: 0;
		padding: 4px 7px;
		background: transparent;
		color: inherit;
		font: 10px mono, ui-monospace, monospace;
		font-weight: bold;
		text-transform: uppercase;
		cursor: pointer;
	}
	#${EFFECT_ID} .august21-controls button:hover,
	#${EFFECT_ID} .august21-controls button:focus-visible { background: var(--august21-colour); color: #000; outline: 2px solid #fff; }
	#${EFFECT_ID}[data-state="cyan"] .august21-scanlines { opacity: .35; animation-duration: 2.1s; }
	#${EFFECT_ID}[data-state="sphere"] .august21-lens { opacity: .85; animation: august21Lens 4.2s ease-in-out infinite; }
	#${EFFECT_ID}[data-state="fracture"] .august21-fractures { opacity: .88; }
	#${EFFECT_ID}[data-state="gold"] .august21-diagram,
	#${EFFECT_ID}[data-state="mad"] .august21-diagram { opacity: .32; }
	#${EFFECT_ID}[data-state="gold"] .august21-scanlines,
	#${EFFECT_ID}[data-state="mad"] .august21-scanlines { background-color: #ffd7000b; }
	#${EFFECT_ID}[data-state="mad"] .august21-status { animation: august21Jolt .42s steps(2, end) infinite; }
	#${EFFECT_ID}[data-state="recovery"] { opacity: .72; }
	#${EFFECT_ID}.august21-reduced-motion * { animation: none !important; transition: none !important; }
	.august21-html-canvas {
		position: fixed;
		left: 14px;
		bottom: 14px;
		z-index: 7;
		width: 270px;
		height: 86px;
		pointer-events: none;
		filter: drop-shadow(4px 4px 0 #000);
	}
	.august21-html-source {
		box-sizing: border-box;
		width: 250px;
		height: 66px;
		padding: 9px;
		border: 2px solid #ffd700;
		background: #000;
		color: #ffd700;
		font: 900 13px mono, ui-monospace, monospace;
		text-transform: uppercase;
	}
	.august21-html-source small { display: block; margin-top: 5px; color: #00ffff; font-size: 9px; letter-spacing: .12em; }
	@keyframes august21Scan { to { background-position: 0 42px; } }
	@keyframes august21Lens { 50% { transform: scale(.975) rotate(.42deg); filter: hue-rotate(42deg); } }
	@keyframes august21Jolt { 25% { transform: translateX(calc(-50% + 2px)) rotate(.35deg); } 75% { transform: translateX(calc(-50% - 2px)) rotate(-.42deg); } }
	@media (max-width: 520px) {
		#${EFFECT_ID} .august21-status { top: 8px; padding: 7px 8px; }
		#${EFFECT_ID} .august21-status::before { font-size: 8px; }
		#${EFFECT_ID} .august21-controls button { font-size: 9px; padding: 4px 5px; }
		.august21-html-canvas { display: none; }
	}
	@media (prefers-reduced-motion: reduce) {
		#${EFFECT_ID} * { animation: none !important; }
	}
`;

/**@type {HTMLElement|null}*/let root = null;
/**@type {HTMLStyleElement|null}*/let styleElement = null;
/**@type {HTMLCanvasElement|null}*/let canvas = null;
/**@type {HTMLCanvasElement|null}*/let htmlCanvas = null;
/**@type {CanvasRenderingContext2D|null}*/let context = null;
/**@type {number|null}*/let animationFrame = null;
/**@type {MediaQueryList|null}*/let motionQuery = null;
/**@type {(() => void)|null}*/let htmlCanvasRefresh = null;
/**@type {Array<{x:number,y:number,vx:number,vy:number,size:number,rotation:number,token:string}>}*/let particles = [];
let stateIndex = 0;
let stateStartedAt = 0;
let lastFrameAt = 0;
let lastStatusSecond = -1;
let reducedMotion = false;
let viewWidth = 0;
let viewHeight = 0;

function randomGenerator(seed) {
	return function() {
		seed |= 0;
		seed = seed + 0x6D2B79F5 | 0;
		let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
		value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
		return ((value ^ value >>> 14) >>> 0) / 4294967296;
	};
}

function resetParticles() {
	const random = randomGenerator(2108 + stateIndex * 42);
	particles = Array.from({ length: 42 }, (_, index) => ({
		x: random() * viewWidth,
		y: random() * viewHeight,
		vx: (random() - .5) * 24,
		vy: 9 + random() * 32,
		size: 9 + random() * 22,
		rotation: (random() - .5) * .3,
		token: TOKENS[(index + Math.floor(random() * TOKENS.length)) % TOKENS.length]
	}));
}

function resizeCanvas() {
	if (!canvas || !context) return;
	viewWidth = window.innerWidth;
	viewHeight = window.innerHeight;
	const ratio = Math.min(window.devicePixelRatio || 1, 2);
	canvas.width = Math.floor(viewWidth * ratio);
	canvas.height = Math.floor(viewHeight * ratio);
	context.setTransform(ratio, 0, 0, ratio, 0, 0);
	resetParticles();
}

function setReducedMotion(nextReducedMotion) {
	reducedMotion = nextReducedMotion;
	root?.classList.toggle("august21-reduced-motion", reducedMotion);
	const motionButton = /**@type {HTMLButtonElement|null}*/(root?.querySelector("[data-action='motion']"));
	if (motionButton) motionButton.textContent = `motion: ${reducedMotion ? "low" : "full"}`;
}

function updateState(nextStateIndex) {
	if (!root) return;
	stateIndex = (nextStateIndex + STATES.length) % STATES.length;
	const state = STATES[stateIndex];
	root.dataset.state = state.id;
	root.style.setProperty("--august21-colour", state.colour);
	const label = root.querySelector(".august21-state-label");
	const phrase = root.querySelector(".august21-phrase");
	if (label) label.textContent = `${stateIndex + 1}/${STATES.length} ${state.label}`;
	if (phrase) phrase.textContent = state.phrase;
	lastStatusSecond = -1;
	resetParticles();
	htmlCanvasRefresh?.();
}

function drawArrow(fromX, fromY, toX, toY, colour) {
	if (!context) return;
	const angle = Math.atan2(toY - fromY, toX - fromX);
	context.strokeStyle = colour;
	context.lineWidth = 1.2;
	context.beginPath();
	context.moveTo(fromX, fromY);
	context.lineTo(toX, toY);
	context.lineTo(toX - 10 * Math.cos(angle - Math.PI / 6), toY - 10 * Math.sin(angle - Math.PI / 6));
	context.moveTo(toX, toY);
	context.lineTo(toX - 10 * Math.cos(angle + Math.PI / 6), toY - 10 * Math.sin(angle + Math.PI / 6));
	context.stroke();
}

function drawScene(time, deltaSeconds) {
	if (!context || !root) return;
	const state = STATES[stateIndex];
	context.clearRect(0, 0, viewWidth, viewHeight);
	context.save();

	if (state.id === "sphere") {
		context.globalAlpha = .22;
		context.strokeStyle = "#00ffff";
		context.lineWidth = 2;
		for (let radius = Math.min(viewWidth, viewHeight) * .14; radius < Math.min(viewWidth, viewHeight) * .48; radius += 42) {
			context.beginPath();
			context.ellipse(viewWidth / 2, viewHeight / 2, radius, radius * .62, Math.sin(time / 4200) * .12, 0, Math.PI * 2);
			context.stroke();
		}
	}

	if (state.id === "fracture" || state.id === "mad") {
		context.globalAlpha = .4;
		for (let index = 0; index < 9; index++) {
			const endX = (index % 2 ? .1 : .9) * viewWidth + Math.sin(index * 42) * viewWidth * .12;
			const endY = (index / 8) * viewHeight;
			drawArrow(viewWidth / 2, viewHeight / 2, endX, endY, index % 3 ? "#00ffff" : "#ffd700");
		}
	}

	context.textBaseline = "middle";
	context.textAlign = "left";
	for (let index = 0; index < particles.length; index++) {
		const particle = particles[index];
		if (!reducedMotion) {
			particle.x += particle.vx * deltaSeconds;
			particle.y += particle.vy * deltaSeconds;
			if (particle.y > viewHeight + 80) particle.y = -40;
			if (particle.x < -260) particle.x = viewWidth + 20;
			if (particle.x > viewWidth + 260) particle.x = -200;
		}
		context.save();
		context.translate(particle.x, particle.y);
		context.rotate(particle.rotation + (reducedMotion ? 0 : Math.sin(time / 4200 + index) * .025));
		context.globalAlpha = state.id === "recovery" ? .13 : .25 + index % 4 * .08;
		context.fillStyle = state.id === "gold" || (state.id === "mad" && index % 2) ? "#ffd700" : index % 7 === 0 ? "#fff" : "#00ffff";
		context.font = `900 ${particle.size}px mono, ui-monospace, monospace`;
		context.fillText(particle.token, 0, 0);
		context.restore();
	}

	context.textAlign = "center";
	context.globalAlpha = state.id === "mad" ? .17 : .08;
	context.fillStyle = state.colour;
	context.font = `900 ${Math.max(52, Math.min(viewWidth / 7, 150))}px mono, ui-monospace, monospace`;
	context.fillText(state.phrase, viewWidth / 2, viewHeight * .58);
	context.restore();
}

function animate(time) {
	if (!root) return;
	const elapsed = time - stateStartedAt;
	if (elapsed >= STATE_DURATION) {
		const skippedStates = Math.floor(elapsed / STATE_DURATION);
		stateStartedAt += skippedStates * STATE_DURATION;
		updateState(stateIndex + skippedStates);
	}

	const stateElapsed = Math.max(0, time - stateStartedAt);
	const remainingSeconds = Math.max(0, Math.ceil((STATE_DURATION - stateElapsed) / 1000));
	if (remainingSeconds !== lastStatusSecond) {
		const seconds = root.querySelector(".august21-seconds");
		if (seconds) seconds.textContent = String(remainingSeconds).padStart(2, "0");
		lastStatusSecond = remainingSeconds;
	}
	root.style.setProperty("--august21-progress", `${Math.min(100, stateElapsed / STATE_DURATION * 100)}%`);

	if (!reducedMotion || time - lastFrameAt >= 500) {
		drawScene(time, Math.min((time - lastFrameAt) / 1000, .1));
		lastFrameAt = time;
	}
	animationFrame = requestAnimationFrame(animate);
}

function setupHtmlInCanvas() {
	const candidate = document.createElement("canvas");
	const candidateContext = candidate.getContext("2d");
	const experimentalContext = /**@type {any}*/(candidateContext);
	const experimentalCanvas = /**@type {any}*/(candidate);
	if (!candidateContext || !("layoutSubtree" in candidate)
		|| typeof experimentalContext.drawElementImage !== "function"
		|| typeof experimentalCanvas.requestPaint !== "function") {
		return;
	}

	htmlCanvas = candidate;
	candidate.className = "august21-html-canvas";
	candidate.width = 270;
	candidate.height = 86;
	candidate.setAttribute("layoutsubtree", "");
	candidate.setAttribute("aria-hidden", "true");
	const source = document.createElement("div");
	source.className = "august21-html-source";
	source.innerHTML = `DOM CAPTURED: C42Ё!!!<small>experimental HTML-in-canvas active</small>`;
	candidate.appendChild(source);
	document.body.appendChild(candidate);

	const paint = () => {
		candidateContext.clearRect(0, 0, candidate.width, candidate.height);
		candidateContext.save();
		candidateContext.translate(10, 10);
		try {
			experimentalContext.drawElementImage(source, 0, 0);
		}
		catch (error) {
			console.warn("August 21 HTML-in-canvas enhancement failed", error);
			htmlCanvasRefresh = null;
			candidate.remove();
		}
		candidateContext.restore();
	};
	candidate.addEventListener("paint", paint);
	htmlCanvasRefresh = () => experimentalCanvas.requestPaint();
	htmlCanvasRefresh();
}

function disableForToday() {
	disableAugust21ForToday();
	disable();
	const themeName = document.getElementById("themeDropName");
	if (themeName) {
		themeName.textContent = `🖌️ ${document.documentElement.dataset.theme || "r/place 2022"}`;
	}
}

/**
 * @param {Function} forceTheme
 */
export async function enable(forceTheme) {
	disable();
	await forceTheme("r/place 2022", "dark");

	styleElement = document.createElement("style");
	styleElement.id = "august21EffectStyle";
	styleElement.textContent = STYLE;
	document.head.appendChild(styleElement);

	root = document.createElement("section");
	root.id = EFFECT_ID;
	root.setAttribute("aria-label", "August 21 client chaos controls");
	root.innerHTML = `
		<div class="august21-diagram" aria-hidden="true"></div>
		<div class="august21-lens" aria-hidden="true"></div>
		<canvas class="august21-canvas" aria-hidden="true"></canvas>
		<div class="august21-scanlines" aria-hidden="true"></div>
		<div class="august21-fractures" aria-hidden="true"></div>
		<div class="august21-status">
			<div class="august21-status-row">
				<span class="august21-code">C42Ё</span>
				<span class="august21-state-copy">
					<span class="august21-state-label"></span>
					<span class="august21-phrase"></span>
				</span>
				<span class="august21-seconds">42</span>
			</div>
			<div class="august21-progress" aria-hidden="true"></div>
			<div class="august21-controls">
				<button type="button" data-action="next" title="Advance to the next anomaly">∆ destabilise</button>
				<button type="button" data-action="motion" title="Toggle reduced motion">motion: full</button>
				<button type="button" data-action="disable" title="Disable the event for today">calm down</button>
			</div>
		</div>`;
	document.body.appendChild(root);

	canvas = /**@type {HTMLCanvasElement}*/(root.querySelector(".august21-canvas"));
	context = canvas.getContext("2d");
	if (!context) {
		disable();
		return;
	}

	root.querySelector("[data-action='next']")?.addEventListener("click", () => {
		stateStartedAt = performance.now();
		updateState(stateIndex + 1);
	});
	root.querySelector("[data-action='motion']")?.addEventListener("click", () => {
		localStorage.setItem(MOTION_KEY, reducedMotion ? "0" : "1");
		setReducedMotion(!reducedMotion);
	});
	root.querySelector("[data-action='disable']")?.addEventListener("click", disableForToday);

	motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
	const savedMotionPreference = localStorage.getItem(MOTION_KEY);
	setReducedMotion(savedMotionPreference === null ? motionQuery.matches : savedMotionPreference === "1");
	motionQuery.addEventListener("change", handleMotionPreferenceChange);
	window.addEventListener("resize", resizeCanvas);
	resizeCanvas();
	setupHtmlInCanvas();
	stateStartedAt = performance.now();
	lastFrameAt = stateStartedAt;
	updateState(0);
	animationFrame = requestAnimationFrame(animate);
}

function handleMotionPreferenceChange(event) {
	if (localStorage.getItem(MOTION_KEY) === null) {
		setReducedMotion(event.matches);
	}
}

export function disable() {
	if (animationFrame !== null) cancelAnimationFrame(animationFrame);
	window.removeEventListener("resize", resizeCanvas);
	motionQuery?.removeEventListener("change", handleMotionPreferenceChange);
	animationFrame = null;
	motionQuery = null;
	htmlCanvasRefresh = null;
	particles = [];
	context = null;
	canvas = null;
	root?.remove();
	styleElement?.remove();
	htmlCanvas?.remove();
	root = null;
	styleElement = null;
	htmlCanvas = null;
}
