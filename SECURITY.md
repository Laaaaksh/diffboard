# Security Policy

## Supported versions

diffboard is a young project. Security fixes are made against the **latest release** and
`master` only - please confirm you can reproduce the issue on the newest release before
reporting.

| Version        | Supported |
| -------------- | --------- |
| latest release | yes       |
| older releases | no        |

## Reporting a vulnerability

Please do **not** open a public GitHub issue for anything you believe is a security problem.

Use GitHub's private vulnerability reporting instead:

> https://github.com/Laaaaksh/diffboard/security/advisories/new

That link reaches the maintainer privately - the report, follow-up discussion, and any fix
coordination stay confidential until a patched release ships.

When reporting, please include:

- diffboard version (CLI and/or dashboard)
- How you're running the dashboard (docker-compose, bare `next start`, etc.)
- Clear steps to reproduce

## What belongs in a report

diffboard is a self-hosted dashboard plus a CLI that runs in your CI. Things worth reporting:

- **Authentication/authorization bypass** - a way to read or modify another project's builds,
  screenshots, or baselines without that project's token, or to act on the dashboard without a
  valid session.
- **Cross-tenant data leakage** - the dashboard is designed so one project's token can never
  read or write another project's data; any way around that is in scope.
- **Stored secrets** - a project's GitHub PAT (`githubToken`, used to flip commit statuses when
  a reviewer approves outside of CI) or a project's CLI token leaking through an API response,
  log line, or error message.
- **Path traversal in image storage** - `STORAGE_DIR` is meant to be a sandbox; any way to read
  or write outside it via a crafted screenshot name/key is in scope.
- **The CLI executing anything beyond launching its own headless Chromium against the URLs you
  configured** - it should never act on content it captures.

Out of scope:

- Vulnerabilities in Playwright/Chromium itself - please report those upstream.
- Denial of service against a self-hosted instance you don't control (e.g. someone else's
  dashboard) - that's a hosting/ops concern for the operator, not a code vulnerability here.
- Issues that require an attacker to already have your project's CLI token or dashboard admin
  credentials - both are trusted secrets by design, the same way an API key or a database
  password is.

## Credits

Reporters who wish to be credited in a fix's release notes may say so in the private report;
otherwise reports are handled without attribution.
