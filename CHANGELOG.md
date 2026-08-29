# Changelog

All notable changes to diffboard are documented in this file. Format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- `diffboard` CLI: captures screenshots with Playwright across a configurable target ×
  viewport matrix, diffs each against its approved baseline with a perceptual pixel-diff
  engine (antialiasing-aware, ignores font-rendering noise), and pushes results to a
  dashboard.
- Sensible capture defaults to cut false-positive diffs: CSS animations/transitions are
  frozen before every screenshot, and per-target CSS-selector masking is supported for
  known-dynamic content (timestamps, live counters).
- Self-hosted review dashboard (Next.js + Postgres): per-build screenshot list, a
  slider/side-by-side/diff-overlay comparison view, and explicit Approve/Reject actions
  that update the branch's baseline and the build's status.
- GitHub integration: the CLI posts a commit status and a PR comment summarizing changed
  screenshots using the CI job's own `GITHUB_TOKEN`; approving or rejecting a snapshot from
  the dashboard (outside of CI) flips that status via an optional project-level PAT.
- `docker-compose.yml` for one-command self-hosting (dashboard + Postgres), with migrations
  and the first admin account bootstrapped automatically on first boot.
- `diffboard init` scaffolds a starter `diffboard.config.js`.

[Unreleased]: https://github.com/Laaaaksh/diffboard/commits/main
