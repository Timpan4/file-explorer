# File Explorer

Windows-first file explorer rebooted from scratch as a Rust application with a thin Tauri renderer.

**Goal:** feel like the file manager Windows should have shipped: native-feeling, theme-aware, compact, calm, modern, and visibly faster than Files.

## Quick Start

Requirements:

- Bun
- Rust and Cargo
- Tauri v2 system prerequisites for Windows

Install dependencies and start the desktop app:

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

To artificially slow navigation for UI testing, set `VITE_EXPLORER_NAV_DELAY_MS` before starting dev.

PowerShell example:

```powershell
$env:VITE_EXPLORER_NAV_DELAY_MS = "500"
bun run tauri dev
```

## What Works Today

- Rust-backed streamed directory navigation
- snapshot caching and cancellation-aware jobs
- native Windows icon hydration
- virtualized details list
- breadcrumbs and path navigation
- tabs
- keyboard selection and navigation
- rename, delete, and create-folder actions
- Rust-owned sort, filter, and search
- developer timing traces and artificial navigation delay controls

## Product Direction

- Beat Files on perceived speed, not just binary size.
- Keep filesystem logic in Rust.
- Use Tauri and SvelteKit as the UI renderer and app host.
- Optimize for Windows first while keeping Rust interfaces portable enough for future macOS/Linux backends.
- Preserve Explorer familiarity while improving visual clarity, theme behavior, and responsiveness.

## Safety and Performance Model

The frontend does not own filesystem behavior. Svelte sends typed user intent through Tauri wrappers; Rust owns directory enumeration, sorting, filtering, search, metadata hydration, cancellation, and file operations.

Expensive enrichments such as thumbnails, Git state, hashes, preview generation, cloud metadata, archive inspection, and network providers stay off the navigation hot path. Large lists are virtualized from day one.

## Stack

- Tauri 2
- SvelteKit and Svelte 5
- TypeScript
- Bun
- Rust workspace crates
- Windows shell/filesystem APIs through `crates/platform-windows`

## Current Focus

Move from fast single-pane navigation into daily-driver productivity:

- file operation queue with progress, cancellation, and conflict handling
- performance metrics collection for startup, navigation, sort, search, and scroll budgets
- dual-pane state model
- native or shell-backed Windows context menu flow
- full session restore across app restarts

## Docs

See the [docs index](docs/README.md) for the full set, ordered by reading priority. Top entry points:

- [Product Vision](docs/product-vision.md)
- [Architecture Blueprint](docs/architecture-blueprint.md)
- [Development Workflow](docs/development-workflow.md)
- [Engineering Handbook](docs/handbook/README.md)
- [Contributor Guide](CONTRIBUTING.md)
- [Agent Guide](AGENTS.md)

The design authority for UI work is [DESIGN.md](DESIGN.md). Roadmap tracking lives in [ROADMAP.md](ROADMAP.md) and near-term task tracking lives in [TODOS.md](TODOS.md).
