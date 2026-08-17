import { describe, expect, test } from "bun:test";
import { mat4 } from "gl-matrix";
import { BoardRenderer } from "./board-renderer.js";

function createRenderer({
	boardWidth,
	boardHeight,
	cssWidth,
	cssHeight,
	devicePixelRatio,
	x,
	y,
	z,
	left = 0,
	top = 0
}) {
	const drawingBufferWidth = cssWidth * devicePixelRatio;
	const drawingBufferHeight = cssHeight * devicePixelRatio;
	const renderer = Object.create(BoardRenderer.prototype);

	renderer.canvas = {
		width: drawingBufferWidth,
		height: drawingBufferHeight,
		getBoundingClientRect() {
			return {
				left,
				top,
				right: left + cssWidth,
				bottom: top + cssHeight,
				width: cssWidth,
				height: cssHeight
			};
		}
	};
	renderer._gl = { drawingBufferWidth, drawingBufferHeight };
	renderer._devicePixelRatio = devicePixelRatio;
	renderer._boardWidth = boardWidth;
	renderer._boardHeight = boardHeight;
	renderer._x = x;
	renderer._y = y;
	renderer._z = z;
	renderer._modelMatrix = mat4.create();
	renderer._viewMatrix = mat4.create();
	renderer._projectionMatrix = mat4.create();
	renderer._mvpMatrix = mat4.create();

	return renderer;
}

function legacyCanvasPosition(renderer, boardX, boardY) {
	const scale = renderer._z * 50;
	return {
		x: renderer.canvas.width / renderer._devicePixelRatio / 2
			+ (boardX - renderer._x) * scale,
		y: renderer.canvas.height / renderer._devicePixelRatio / 2
			+ (boardY - renderer._y) * scale
	};
}

function expectPointClose(actual, expected) {
	expect(actual.x).toBeCloseTo(expected.x, 3);
	expect(actual.y).toBeCloseTo(expected.y, 3);
}

describe("BoardRenderer 2D projection", () => {
	test("matches the legacy canvas transform on a square board at high DPI", () => {
		const renderer = createRenderer({
			boardWidth: 1000,
			boardHeight: 1000,
			cssWidth: 1200,
			cssHeight: 800,
			devicePixelRatio: 2,
			x: 412.5,
			y: 376.5,
			z: 0.02,
			left: 17,
			top: 29
		});

		for (const [boardX, boardY] of [
			[renderer._x, renderer._y],
			[0, 0],
			[432.75, 346.25],
			[1000, 1000]
		]) {
			const expected = legacyCanvasPosition(renderer, boardX, boardY);
			expectPointClose(renderer.boardToCanvasElementCoords(boardX, boardY), expected);

			const picked = renderer.hitTest(expected.x + 17, expected.y + 29);
			expectPointClose(picked, { x: boardX, y: boardY });
		}
	});

	test("preserves independent pixel scale on a non-square board and viewport", () => {
		const renderer = createRenderer({
			boardWidth: 1600,
			boardHeight: 600,
			cssWidth: 900,
			cssHeight: 700,
			devicePixelRatio: 1.25,
			x: 700.5,
			y: 250.5,
			z: 0.04
		});

		for (const [boardX, boardY] of [
			[renderer._x, renderer._y],
			[725.25, 270.75],
			[640.125, 190.875]
		]) {
			const expected = legacyCanvasPosition(renderer, boardX, boardY);
			expectPointClose(renderer.boardToCanvasElementCoords(boardX, boardY), expected);
			expectPointClose(renderer.hitTest(expected.x, expected.y), {
				x: boardX,
				y: boardY
			});
		}
	});

	test("aligns the HTML pixel cursor with the selected board pixel", () => {
		const renderer = createRenderer({
			boardWidth: 1000,
			boardHeight: 1000,
			cssWidth: 1366,
			cssHeight: 768,
			devicePixelRatio: 1,
			x: 503.7,
			y: 401.2,
			z: 0.4
		});
		const selectedPixel = {
			x: Math.floor(renderer._x),
			y: Math.floor(renderer._y)
		};
		const expected = legacyCanvasPosition(renderer, selectedPixel.x, selectedPixel.y);

		expectPointClose(
			renderer.boardToCanvasElementCoords(selectedPixel.x, selectedPixel.y),
			expected
		);
		expectPointClose(renderer.hitTest(expected.x, expected.y), selectedPixel);
	});
});
