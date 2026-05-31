# File Explorer

Windows-first desktop file explorer with a Rust filesystem core and a thin Tauri/Svelte renderer.

The goal is simple: feel like the file manager Windows should have shipped. It should be native-feeling, theme-aware, compact, calm, modern, and visibly faster than Files.

## Quick Start

Requirements:

- Bun
- Rust and Cargo
- Tauri 2 Windows system prerequisites

Install dependencies and start the desktop app:

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

`bun run check` runs the full local bundle: frontend typecheck, Bun tests, Rust tests, and Rust check.
`bun run rust:test` and `bun run rust:check` cover the full Rust workspace on Windows; on non-Windows hosts they run the portable core crate and leave Windows platform verification to a Windows machine.

To slow navigation for UI testing, set `VITE_EXPLORER_NAV_DELAY_MS` before starting dev.

```powershell
$env:VITE_EXPLORER_NAV_DELAY_MS = "500"
bun run tauri dev
```

## Current Capabilities

- Rust-backed streamed directory navigation
- snapshot caching and cancellation-aware jobs
- native Windows icon hydration
- virtualized details list
- breadcrumbs and path navigation
- tabs
- keyboard navigation and selection
- rename, delete-to-recycle-bin, and create-folder actions
- Rust-owned sort, filter, and search
- developer timing traces and artificial navigation delay controls

## Product Rules

- Rust owns directory enumeration, sorting, filtering, search, metadata hydration, cancellation, and file operations.
- Svelte renders typed state and sends typed user intent through Tauri wrappers.
- Large lists stay virtualized.
- Expensive enrichments such as thumbnails, Git state, hashes, previews, cloud metadata, archive inspection, and network providers stay off the navigation hot path.
- Windows is the first-class platform; Rust boundaries should still leave room for future macOS/Linux backends.

## Stack

- Tauri 2
- SvelteKit and Svelte 5
- TypeScript
- Bun
- Rust workspace crates
- Windows shell and filesystem APIs through `crates/platform-windows`

## Current Focus

The project is moving from fast single-pane navigation toward daily-driver file work:

- queued copy/move operations with progress, cancellation, and conflict handling
- startup, navigation, sort, search, and scroll metrics
- dual-pane state model
- native or shell-backed Windows context menu flow
- full session restore across app restarts

## Docs

Start with the [docs index](docs/README.md). Key entry points:

- [Product Vision](docs/product-vision.md)
- [Architecture Blueprint](docs/architecture-blueprint.md)
- [Development Workflow](docs/development-workflow.md)
- [Engineering Handbook](docs/handbook/README.md)
- [Contributor Guide](CONTRIBUTING.md)
- [Agent Guide](AGENTS.md)

UI work follows [DESIGN.md](DESIGN.md). Product tracking lives in [ROADMAP.md](ROADMAP.md) and [TODOS.md](TODOS.md).
