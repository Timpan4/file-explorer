# Contributing

This repo is a Windows-first Tauri 2 + SvelteKit + Rust file explorer. Contributions should preserve the central boundary: Rust owns filesystem behavior; Svelte renders typed state and sends typed user intent.

## Start Here

Before changing code, read:

- [README.md](README.md) for setup and current state.
- [docs/product-vision.md](docs/product-vision.md) for product direction.
- [docs/architecture-blueprint.md](docs/architecture-blueprint.md) for module boundaries.
- [docs/development-workflow.md](docs/development-workflow.md) for checks and testing expectations.
- [docs/handbook/README.md](docs/handbook/README.md) for organization and hygiene rules.

For UI work, also read [DESIGN.md](DESIGN.md).

## Development Setup

```sh
bun install
bun run tauri dev
```

Useful checks:

```sh
bun run check
bun run build
cargo check
cargo test
```

## Contribution Rules

- Keep diffs focused on one logical change.
- Do not move filesystem behavior into Svelte.
- Do not add dependencies without verifying the current stable version from an authoritative source.
- Keep large lists virtualized.
- Keep expensive enrichments off the navigation hot path.
- Preserve same-path refresh behavior: keep current content visible until a replacement snapshot is ready.
- Update [ROADMAP.md](ROADMAP.md) or [TODOS.md](TODOS.md) when a tracked item is completed.
- Add an ADR under [docs/decisions/](docs/decisions/) before changing a locked-in boundary.

## Git Workflow

Before any git write, check the current branch:

```sh
git branch --show-current
```

If the branch is `gitbutler/workspace`, use GitButler for writes:

- use `but` commands for add/commit/push/branch/PR operations
- use `but diff --no-tui` for diffs
- do not leave the workspace branch
- do not fall back to raw git writes if `but` is unavailable

Branch names should use a concrete prefix such as `feat/`, `fix/`, `docs/`, `refactor/`, `test/`, `chore/`, or `perf/`. Commit subjects should describe one concrete outcome. Do not add AI or coauthor attribution unless requested.

## Pull Request Expectations

Before opening a PR or handing work back, run through [docs/handbook/pr-checklist.md](docs/handbook/pr-checklist.md).

At minimum, report:

- what changed
- what checks ran
- what remains unverified, if anything

Docs-only changes usually need link and content review rather than a full app build.
