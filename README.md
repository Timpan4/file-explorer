# File Explorer

Windows-first file explorer rebooted from scratch as a Rust application with a thin Tauri renderer.

## Product Direction

- Beat `Files` on perceived speed, not just binary size.
- Keep all file-system logic in Rust.
- Use Tauri and SvelteKit only as the UI renderer.
- Optimize for Windows first while keeping Rust interfaces portable enough for future macOS/Linux backends.

## Core Principles

- Navigation must be incremental, cancelable, and benchmarked.
- The UI never owns sorting, searching, metadata hydration, or file operations.
- Expensive enrichments such as thumbnails, Git state, hashes, preview generation, and cloud metadata stay off the hot path.
- Large lists must be virtualized from day one.

## Current State

This repo is a Tauri 2 + SvelteKit shell with Rust workspace crates for core IPC/job types, Windows platform file-system integration, and the Tauri host:

- `Tauri 2`
- `SvelteKit`
- `TypeScript`
- `bun`
- `Rust`

The current explorer slice includes Rust-backed streamed directory navigation, snapshot caching, cancellation, native icon hydration, a virtualized details list, breadcrumbs, tabs, keyboard selection/navigation, rename/delete/create-folder actions, Rust-owned sort/filter/search, and developer timing traces.

Current product focus:

- File operation queue with progress, cancellation, and conflict handling.
- Performance metrics collection for startup, navigation, sort, search, and scroll budgets.
- Dual-pane state model.
- Native or shell-backed Windows context menu flow.
- Full session restore across app restarts.

## Planning Docs

- `ROADMAP.md` - product and architecture roadmap
- `TODOS.md` - implementation backlog for the next build phases

## Why Svelte Here

Svelte is a good fit for this architecture because the frontend is intentionally thin. It keeps renderer code smaller and simpler than a typical Vue setup while still being perfectly capable of hosting virtualized views, panes, tabs, and command surfaces.

Vue would also work, but for a renderer-only desktop shell I would pick Svelte first unless your team already has strong Vue momentum.

## Development

```sh
bun install
bun run tauri dev
```

To artificially slow navigation for UI testing, set `VITE_EXPLORER_NAV_DELAY_MS` before starting dev.

PowerShell example:

```powershell
$env:VITE_EXPLORER_NAV_DELAY_MS = "500"
bun run tauri dev
```

## Current Goal

Move from fast single-pane navigation into daily-driver productivity: reliable file operations, measured performance, dual-pane workflows, shell-native actions, and restart-safe session restore.
