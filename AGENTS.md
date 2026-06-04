# rplace.live client agent notes

This is the client for rplace.live. Keep documentation contributor-facing: describe client architecture, public interfaces, workflows, and visible behaviour.

## Client Shape

- `index.html` contains the main game markup and loads page modules.
- `src/pages/index/index.js` owns most game UI behaviour, including placement, chat, menus, captcha/passkey prompts, viewport events, and startup wiring.
- `src/pages/index/game-state.js` starts the server-provided game worker, stores websocket-derived state, and turns worker IPC messages into DOM events.
- Renderer, palette, viewport, settings, and service modules should remain focused on their existing areas.

## Worker Boundary

- From this repository's perspective, the game worker owns websocket and protocol communication.
- Main client code talks to the worker through `shared-ipc` actions and public worker events.
- Keep websocket-specific details out of normal UI code.
- Browser-only APIs, such as WebAuthn, DOM, canvas UI, storage, and user prompts, belong in the main client.
- Coordinate worker-facing interface changes with matching server changes. Prefer small additive events/actions.

## Build And Development

- Install dependencies with `bun install`.
- Run the dev server with `bun run dev`.
- Build with `bun run build`.
- Preview with `bun run serve`.
- Avoid new dependencies unless platform APIs and existing utilities are not enough.

## Coding Style

- Use direct JavaScript with JSDoc where useful.
- Prefer small local helpers over new global abstractions.
- Match existing naming and file ownership.
- Do not reformat unrelated files.
- Preserve trusted-event checks around sensitive user actions.
