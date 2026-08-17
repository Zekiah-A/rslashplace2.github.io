# rplace.live client agent notes

This is the client for rplace.live. Keep documentation contributor-facing: describe client architecture, public interfaces, workflows, and visible behaviour.

---

## YAGNI and implementation discipline

This project follows YAGNI aggressively.

Before adding code, abstractions, systems, files, managers, wrappers, middleware, protocols, queues, caches, configuration, or future-proofing, ask:

1. does this need to exist for the current task?
2. does the current code already solve most of the problem?
3. can a smaller local change solve it?
4. can deletion or simplification solve it instead?
5. will this make security, performance, or debugging clearer?
6. is this being built for a real current requirement, or an imagined future one?

If the answer is "maybe later", do not build it now.

Prefer the smallest working change that preserves correctness, security, performance, and readability.

Do NOT add:

* speculative abstractions;
* one-use managers;
* generic systems for one concrete feature;
* wrapper layers around simple APIs;
* configuration for values that do not currently vary;
* background workers without a measured need;
* queues, schedulers, or caches without a current bottleneck;
* protocol complexity without a current security or performance reason;
* new files when an existing module can be cleanly extended;
* future anti-abuse systems that are not part of the current threat model.

Deletion beats addition.

Boring beats clever.

Measured performance beats theoretical architecture.

A tiny secure working feature beats a beautiful unfinished framework.

For `rplace.live`, never compromise the important parts just to make a diff smaller:

* server authority;
* rate limiting;
* abuse prevention;
* packet validation;
* worker/client boundary discipline;
* clear separation between public client code and sensitive server logic;
* simple, auditable security decisions.

Do not duplicate authoritative logic in the client.

Do not leak server-side assumptions into the open-source client.

Do not add complexity to the client worker unless it clearly improves performance, security, or protocol clarity.

Lazy means efficient, not careless.

When unsure, implement the smallest correct version, leave the code easy to inspect, and avoid building infrastructure for a future that has not been defined.

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

## Workspace Security Review

This repository is currently being reviewed together with the sibling
`server` repository as part of an authorised security and anti-cheat
assessment of rplace.live.

Shared context is located outside this repository:

- `../agent-context/security-strategy.md`
- `../agent-context/public-reconnaissance.md`
- `../AGENTS.md`

Before beginning any security-related task:

1. Read the workspace `AGENTS.md`.
2. Read both shared context documents in full.
3. Return to this repository and follow all existing instructions in this file.

Treat `security-strategy.md` as the primary specification.

Treat `public-reconnaissance.md` as supplementary public background and attacker context. Confirm behaviour against the local source code before drawing conclusions.

Unless explicitly instructed otherwise, the initial security review is **analysis only**.

During this phase:

- Do not modify production code.
- Do not create branches or commits.
- Do not perform broad refactors.
- Record findings under `../agent-context/findings/`.
- Reference exact files, functions and execution paths.
- Clearly distinguish confirmed findings from hypotheses.