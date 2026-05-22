# Development Workflow

## Package Manager

Use Bun for frontend package management, scripts, and scaffolding.

Install dependencies and start the Tauri app:

```sh
bun install
bun run tauri dev
```

Useful frontend commands:

```sh
bun run check
bun run build
```

Rust checks:

```sh
cargo check
cargo test
```

To artificially slow navigation for UI testing, set `VITE_EXPLORER_NAV_DELAY_MS` before starting dev.

PowerShell example:

```powershell
$env:VITE_EXPLORER_NAV_DELAY_MS = "500"
bun run tauri dev
```

## Dependency Policy

Use the latest stable version by default. Before adding, installing, upgrading, or recommending dependencies, APIs, SDKs, CLIs, frameworks, runtimes, templates, or external services, verify the current stable version from an authoritative source.

Preferred sources:

- `bun pm` or registry metadata for frontend packages
- `cargo search`, `cargo info`, or crates.io for Rust crates
- official docs or release pages for Tauri, SvelteKit, Bun, Rust, and Windows APIs

If the latest stable version conflicts with project constraints, choose the newest compatible version and document why.

## Testing Standard

Tests should prove behavior, contracts, or invariants. Avoid tests that simply mirror implementation branches.

Use focused example tests for regressions and user-visible behavior. Use contract tests when IPC shapes or frontend wrappers can drift. Use property-style tests for pure deterministic logic with compact invariants, such as sort specs, path normalization, selection math, and cache-key behavior.

Do not require property tests for Svelte rendering, native Windows shell integration, or Tauri commands that need live OS state unless the risk justifies the setup.

## Verification Before Completion

Before claiming a task is complete, run the checks that prove it:

- docs-only change: inspect links and headings; no build is usually required
- frontend change: `bun run check`
- production build or routing/static output change: `bun run build`
- Rust backend change: `cargo check`
- Rust behavior change: `cargo test` or targeted crate tests
- Tauri integration change: `bun run tauri dev` smoke test when practical

If a check cannot run locally, say exactly why and what remains unverified.

## Manual Smoke Areas

For UI or Tauri changes, smoke the affected path:

- launch app
- navigate to a normal folder
- navigate to a large folder
- sort and filter/search
- refresh the same path
- select with mouse and keyboard
- verify stale navigation does not overwrite current rows
- verify error UI with an unavailable path when relevant

## Completion Tracking

When work completes a roadmap or TODO item, update [ROADMAP.md](../ROADMAP.md) or [TODOS.md](../TODOS.md) in the same change. Do not tick items early.
