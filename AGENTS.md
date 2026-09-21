# AGENTS.md

## Project Shape

- Bun is the package manager and runtime.
- Use `bun install --frozen-lockfile` with the committed `bun.lock`.
- The OpenCode V2 entrypoint is `src/index.ts`.
- The entrypoint registers `gpt_imagegen` through `ctx.tool.transform`.
- The tool input uses JSON Schema.
- Role-based helpers live in `src/auth.ts`, `src/codex.ts`, `src/input-image.ts`, `src/output-image.ts`, and `src/types.ts`.
- `bun run build` bundles project modules into `dist/index.js`.
- The build keeps package dependencies external.
- `dist/` is ignored locally and included in the published package.
- `bunfig.toml` rejects package versions published less than two days ago.

## Commands

- Run `bun run typecheck` to type-check `src` and `tests`.
- Run `bunx biome ci .` to check formatting and lint rules.
- Run `bun run check` to apply Biome fixes.
- Run `bun run test` to execute unit tests only.
- Do not run bare `bun test` because it also discovers live e2e tests.
- Run `bun run build` to create the package entrypoint.
- Run `bun run test:e2e_subscription` to execute the ChatGPT OAuth e2e test.
- The e2e test uses `opencode2 run --standalone --auto`.
- The e2e test generates real images and can take several minutes.
- CI runs type checking, Biome, unit tests, and the build.
- CI does not run e2e tests because they require OAuth credentials and network access.

## E2E Requirements

- `tests/e2e/subscription.test.ts` runs `opencode2` in a temporary working directory.
- OpenCode V2 must have an active OpenAI ChatGPT OAuth connection.
- The plugin resolves credentials through `ctx.integration.connection`.
- OpenCode refreshes expired credentials during resolution.
- The tests validate PNG output and output path versioning.

## Implementation Notes

- The tool calls the ChatGPT Codex responses endpoint with the hosted `image_generation` tool.
- Resolve relative paths from `ctx.location.directory`.
- Do not overwrite an existing output file.
- Try suffixes from `-v2` through `-v999` after a collision.
- Encode reference images as data URLs after MIME detection.
- Pass the V2 tool cancellation signal to `fetch` when the runtime provides it.
- Return tool text in the V2 `content` field.

## Publishing

- `package.json` publishes only `dist`, `README.md`, and `LICENSE`.
- `prepublishOnly` runs `bun run build`.
- Use `bun run release:patch`, `release:minor`, or `release:major` from a clean `main` branch.
- The release script checks upstream state and creates the release commit and tag.
- A tag triggers `.github/workflows/release.yml`.
- The release workflow publishes with npm trusted publishing and creates a GitHub release.
