# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

## Layout

pnpm workspace, 3 packages: `packages/core` (diff engine + shared types/GitHub API helpers,
no framework deps), `packages/cli` (the `diffboard` CLI, Playwright-based), `packages/server`
(the dashboard: Next.js **Pages Router**, not App Router - `pages/api/**` handlers, session
auth via a hand-rolled cookie helper, no ESLint config). `examples/demo-site` is a real
two-version static fixture (`index-v1.html`/`index-v2.html` behind `server.js`, switched via
`DEMO_VARIANT`) used by both the CLI's capture tests and the README demo GIF - not a mock.

## Local dev

`packages/core` must be built (`pnpm --filter @diffboard/core run build`) before the server
or CLI will type-check or run - both import it as a workspace package resolving to `dist/`.

Server needs Postgres. For local dev, a throwaway container plus a **separate**
`diffboard_test` database on the same instance for the test suite (never reuses the dev DB -
tests call `resetDb()` which truncates everything):

```bash
docker run -d --name diffboard-dev-pg -e POSTGRES_USER=diffboard -e POSTGRES_PASSWORD=diffboard \
  -e POSTGRES_DB=diffboard -p 5432:5432 postgres:16-alpine
docker exec diffboard-dev-pg psql -U diffboard -c "CREATE DATABASE diffboard_test;"
```

`packages/server/.env.test` points at `diffboard_test`; `vitest.setup.ts` loads it via
`dotenv` but never overrides an already-set `DATABASE_URL`, so CI's Postgres service
container env just works without touching that file.

## Server tests import route handlers directly

`packages/server/test/*.test.ts` import `pages/api/**` handler modules directly and drive
them with `node-mocks-http` (see `test/helpers.ts`) rather than spinning up a real HTTP
server - real Postgres, real Prisma, real business logic, no process/port orchestration.
`node-mocks-http`'s `_getJSONData()` typing doesn't resolve to `any` for our usage; use the
`jsonBody<T>()` helper instead of fighting its generics inline.

## Prisma version is pinned to 6.19.3, not latest

Prisma 7 moved `datasource.url` out of `schema.prisma` into a required `prisma.config.ts` +
driver-adapter model (`@prisma/adapter-pg` etc.) - a real breaking change from the
classic `env("DATABASE_URL")` pattern this codebase uses. Both `prisma` and `@prisma/client`
are pinned to the same `6.19.3` in `packages/server/package.json`, and the Docker image
installs the CLI globally at that same pin (see next note). Bumping to 7 means adopting the
new config file, not just changing the version number.

## Docker image: the `prisma` CLI isn't in the standalone bundle

Next's `output: standalone` traces only what the running server actually imports, so the
generated `@prisma/client` comes along for free but the `prisma` CLI binary (needed once, at
boot, for `prisma migrate deploy`) does not. `packages/server/Dockerfile` installs it
globally in the runner stage, pinned to match `schema.prisma`'s generator version. The
monorepo's standalone output nests as `packages/server/server.js` (mirrors the workspace
path), not a flat `server.js` - that's why the Dockerfile's `CMD` looks like it does.

## Release

Tagging `vX.Y.Z` runs `.github/workflows/release.yml`, which sets `packages/cli/package.json`'s
version from the tag and publishes `diffboard` to npm - the package.json version is not
hand-bumped in commits. `scripts/release_notes.sh` pulls that version's section out of
CHANGELOG.md for the GitHub release body and fails the release if that section is missing.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
