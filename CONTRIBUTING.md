# Contributing to diffboard

Thank you for your interest in contributing. diffboard is a self-hosted visual regression
testing tool - a CLI plus a review dashboard - open source under the MIT license.

## Getting started

```bash
git clone https://github.com/<your-username>/diffboard.git   # your fork, see below
cd diffboard
corepack enable
pnpm install
npx playwright install --with-deps chromium

# Start a local Postgres for development.
docker run -d --name diffboard-dev-pg -e POSTGRES_USER=diffboard \
  -e POSTGRES_PASSWORD=diffboard -e POSTGRES_DB=diffboard -p 5432:5432 postgres:16-alpine

cp packages/server/.env.example packages/server/.env
# edit packages/server/.env: DATABASE_URL, SESSION_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD

pnpm --filter @diffboard/server prisma:migrate
pnpm --filter @diffboard/server prisma:generate
pnpm --filter @diffboard/server seed
pnpm --filter @diffboard/core run build
make dev      # dashboard on http://localhost:4300
```

To also work on the CLI against your local dashboard:

```bash
pnpm --filter diffboard run build
DIFFBOARD_TOKEN=<token from the dashboard's New Project screen> \
DIFFBOARD_SERVER_URL=http://localhost:4300 \
node packages/cli/dist/bin.js test --config examples/demo-site/diffboard.config.js
```

## Requirements

- Node.js 20+
- pnpm (via `corepack enable`)
- Docker, for a local Postgres (or point `DATABASE_URL` at one you already run)

## Contribution workflow

The `master` branch is protected: every change lands through a pull request, required status
checks must pass, and protection is enforced for everyone - including the maintainer. There
are no direct pushes to `master`.

1. Fork the repo on GitHub, then clone your fork (command above).
2. Create a descriptively named feature branch from `master`.
3. Make your changes as small, focused commits.
4. Run `make lint` and `make test` - both must pass. `make test` needs the local Postgres
   above (it runs the server's real integration tests against a `diffboard_test` database
   and the CLI's real Playwright-driven capture tests).
5. If your change is user-facing (a feature, fix, or behavior change), add one bullet under
   the `Unreleased` heading in [CHANGELOG.md](CHANGELOG.md).
6. Push the branch to your fork.
7. Open a pull request against `master` here.

A PR can merge only when the `Test` and `Lint` checks pass and all conversation threads are
resolved.

## Project layout

This is a pnpm workspace with three packages:

- `packages/core` - the diff engine (pixelmatch-backed) and shared types/GitHub API helpers,
  used by both the CLI and the server.
- `packages/cli` - the `diffboard` CLI: Playwright screenshot capture, diffing, and pushing
  results to a dashboard.
- `packages/server` - the self-hosted dashboard: a Next.js app (Pages Router) + Prisma/Postgres.

`examples/demo-site/` is a tiny static site with two versions (`index-v1.html`, `index-v2.html`)
used by the CLI's integration tests and the README demo - it's a real fixture, not a mock.

## Releases

Releases are cut by pushing a tag; GitHub Actions does the rest (`.github/workflows/release.yml`):

1. Make sure every user-facing change since the last release has a bullet under `Unreleased`
   in [CHANGELOG.md](CHANGELOG.md) (step 5 above).
2. Give the release its own changelog section: insert `## [x.y.z] - YYYY-MM-DD` above the
   (now empty) `## [Unreleased]` heading, and update the compare links at the bottom of the
   file.
3. Land those changelog edits on `master` through a pull request, then tag and push:

   ```bash
   git tag vx.y.z && git push origin vx.y.z
   ```

The release workflow extracts the tagged version's CHANGELOG section as the GitHub release
notes and publishes the `diffboard` CLI to npm.

## Code style

- TypeScript everywhere, `strict` mode on. No `any` without a comment saying why it's
  unavoidable.
- Match the surrounding file's style over any general convention.
- Comments explain *why*, not *what*.
- Server API routes are plain Next.js Pages Router handlers (`pages/api/**`) - keep auth
  checks (`requireSession` / `requireProject`) as the first line of every handler.
- The CLI and server never share request/response types by accident - `@diffboard/core`
  is the single source of truth for anything both sides need to agree on.

## Reporting issues

Please open a GitHub issue before starting large changes, so scope and approach can be
settled before code is written. Bug reports should include:
- `diffboard --version` (or the dashboard's version, if the bug is there)
- Steps to reproduce
- What you expected vs what happened
