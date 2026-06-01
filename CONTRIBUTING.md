# Contributing

This is a Windows-first Tauri 2, SvelteKit, and Rust file explorer. Keep the central boundary intact: Rust owns filesystem behavior; Svelte renders typed state and sends typed user intent.

## Read First

Before changing code, read:

- [README.md](README.md) for setup and current state.
- [docs/product-vision.md](docs/product-vision.md) for product direction.
- [docs/architecture-blueprint.md](docs/architecture-blueprint.md) for module boundaries.
- [docs/development-workflow.md](docs/development-workflow.md) for checks and testing expectations.
- [docs/handbook/README.md](docs/handbook/README.md) for organization and hygiene rules.

For UI work, also read [DESIGN.md](DESIGN.md).

## Setup

```sh
bun install
bun run tauri dev
```

Useful checks:

```sh
bun run typecheck
bun run test
bun run rust:test
bun run rust:check
bun run check
bun run build
```

`bun run check` runs frontend typecheck, Bun tests, Rust tests, and Rust check.
`bun run rust:test` and `bun run rust:check` cover the full Rust workspace on Windows; on non-Windows hosts they run the portable core crate and leave Windows platform verification to a Windows machine.
Pull requests to `main` run `bun run typecheck`, `bun run test`, `bun run rust:test`, `bun run rust:check`, and `bun run build` in GitHub Actions on Windows and Ubuntu.

## Rules

- Keep each change focused on one outcome.
- Do not move filesystem behavior into Svelte.
- Do not add dependencies without verifying the current stable version from an authoritative source.
- Keep large lists virtualized.
- Keep expensive enrichments off navigation first paint.
- Preserve same-path refresh behavior: keep current rows visible until the replacement snapshot is ready.
- Update [ROADMAP.md](ROADMAP.md) or [TODOS.md](TODOS.md) when tracked work lands.
- Add an ADR under [docs/decisions/](docs/decisions/) before changing a locked-in boundary.

## Git Workflow

Before any git write, check the current branch:

```sh
git branch --show-current
```

If the branch is `gitbutler/workspace`, use GitButler for all writes:

- use `but` for add, commit, push, branch, and PR operations
- use `but diff --no-tui` for diffs
- stay on `gitbutler/workspace`
- if `but` is unavailable or unclear, run `but --help`; do not fall back to raw git writes

Branch names should use `feat/`, `fix/`, `docs/`, `refactor/`, `test/`, `chore/`, or `perf/` with a concrete kebab-case slug. Commit subjects should state one concrete outcome. Do not add AI or coauthor attribution unless requested.

## Before Hand-off

Run through [docs/handbook/pr-checklist.md](docs/handbook/pr-checklist.md). Report:

- what changed
- what checks ran
- what remains unverified

Docs-only changes usually need link and content review rather than a full app build.
