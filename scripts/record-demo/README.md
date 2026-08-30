# Demo recorder

Boots the real diffboard stack from source and records a genuine walkthrough of the product
loop: sign in, create a project, capture a baseline against `examples/demo-site`, ship a real
visual change, and triage the resulting diff in the review dashboard (approve one screenshot,
reject another). Produces `docs/assets/demo.mp4` and `docs/assets/demo.gif` for the README.

This package is dev-only - it lives outside `pnpm-workspace.yaml`'s `packages/*` glob, so it
is never pulled into the product build or `pnpm install` at the repo root.

## Run it

From the repo root:

```bash
make demo
```

Or step by step from this directory:

```bash
npm install
npm run record   # boots Postgres (docker), the dashboard, and demo-site; drives the browser; saves out/demo.raw.webm
npm run convert  # ffmpeg: out/demo.raw.webm -> docs/assets/demo.mp4 + demo.gif
```

## What `record.mjs` does

1. Builds `@diffboard/core`, the CLI, and the server (`next build` - a **production** build;
   `next dev`'s dev-mode overlay intercepts clicks and was flaky under this recorder).
2. Starts a fresh, disposable Postgres container (`diffboard-demo-pg`, host port `5434` so it
   doesn't collide with any dev Postgres on `5432`/`5433`), runs migrations, and seeds the
   admin account.
3. Starts the dashboard (`next start`, port `4300`) and `examples/demo-site` (port `3100`,
   `DEMO_VARIANT=v1`).
4. Drives a headless Chromium via Playwright (`recordVideo`, 1280x800,
   `deviceScaleFactor: 2`) through the real UI: sign in, create a project, capture its token
   from the page.
5. Shells out to the real `diffboard` CLI twice - once against `v1` (baseline) and once
   against `v2` (a real CSS change already in the fixture: a shrunk, washed-out CTA button) -
   and navigates the browser to each resulting build.
6. Reviews the second build's real diff in the dashboard: drags the slider, switches to
   side-by-side and diff-overlay, approves the desktop screenshot (the rebrand is the
   intended change) and rejects the mobile one (the same CSS change shrinks the button below a
   usable tap target on a small screen - a genuine regression, not a fabricated one).
7. Stops every child process and removes the Postgres container so the next run starts clean.

Re-running against a freshly seeded stack produces the same walkthrough - there's no random
data and no reliance on state left over from a previous run.

## Ports

Only `:4300` is a fixed requirement (the app). If `:4300` is already taken by something else,
this fails fast rather than rewriting the committed port - free it and re-run. `:3100` (demo
site) and `:5434` (recorder's own throwaway Postgres) can be changed at the top of
`record.mjs` if they collide with something on your machine.

## Debugging

Child process output (the dashboard and demo-site) is captured to `.tmp/<name>.log` instead
of being discarded, since Next's production server is otherwise silent on success.
