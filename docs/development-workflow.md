# Development Workflow

## Package Manager

Use Bun for frontend package management, scripts, and scaffolding.

Install dependencies and start the Tauri app:

```sh
bun install
bun run tauri dev
```

Common checks:

```sh
bun run typecheck
bun test
bun run rust:test
bun run rust:check
bun run check
bun run build
```

`bun run check` runs the current local verification bundle:

```sh
bun run typecheck && bun test && bun run rust:test && bun run rust:check
```

`bun run rust:test` and `bun run rust:check` run the full Rust workspace on Windows. On non-Windows hosts they run `file-explorer-core` only, because `crates/platform-windows` and the Tauri host bind to Windows APIs. Run the Windows scripts on a Windows machine before claiming platform or Tauri behavior complete.

To slow navigation for UI testing, set `VITE_EXPLORER_NAV_DELAY_MS` before starting dev.

```powershell
$env:VITE_EXPLORER_NAV_DELAY_MS = "500"
bun run tauri dev
```

## Dependency Policy

Use the latest stable version by default. Before adding, installing, upgrading, or recommending dependencies, APIs, SDKs, CLIs, frameworks, runtimes, templates, or external services, verify the current stable version from an authoritative source.

Preferred sources:

- `bun pm`, `npm view`, or registry metadata for frontend packages
- `cargo search`, `cargo info`, or crates.io for Rust crates
- official docs or release pages for Tauri, SvelteKit, Bun, Rust, and Windows APIs

If latest stable conflicts with project constraints, choose the newest compatible version and document why.

## Testing Standard

Tests should prove behavior, contracts, or invariants. Avoid tests that only mirror implementation branches.

Use:

- focused examples for regressions and user-visible behavior
- contract tests when IPC shapes or frontend wrappers can drift
- frontend tests for typed wrappers, pure state logic, path helpers, selection behavior, and stable renderer contracts
- Rust tests for filesystem contracts, snapshot/cache behavior, job cancellation, projection/sort invariants, and Windows platform helpers
- property-style tests for deterministic logic with compact invariants, such as sort specs, path normalization, selection math, and cache keys

Do not require property tests for Svelte rendering, native Windows shell integration, or Tauri commands that need live OS state unless the risk justifies the setup.

## Verification

Run the checks that match the change:

- docs-only change: inspect links and headings; no app build is usually required
- frontend type or component change: `bun run typecheck`
- frontend behavior change: relevant `bun test` coverage
- production build, routing, or static output change: `bun run build`
- Rust backend change: `bun run rust:check`
- Rust behavior change: `bun run rust:test` or targeted crate tests
- full local verification before hand-off: `bun run check`
- Tauri integration change: `bun run tauri dev` smoke test when practical

If a check cannot run locally, report the blocker and what remains unverified.

## Manual Smoke Areas

For UI or Tauri changes, smoke the affected path:

- launch the app
- navigate to a normal folder
- navigate to a large folder
- sort and filter/search
- refresh the same path
- select with mouse and keyboard
- verify stale navigation does not overwrite current rows
- verify error UI with an unavailable path when relevant

## Tracking

When work completes a roadmap or TODO item, update [ROADMAP.md](../ROADMAP.md) or [TODOS.md](../TODOS.md) in the same change. Do not tick items early.
