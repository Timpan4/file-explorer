# Code Organization

This page says where code belongs. The target architecture lives in [architecture-blueprint.md](../architecture-blueprint.md).

## Frontend

`src/lib/components/explorer/`

Explorer-specific UI: shell layout, panes, rows, headers, breadcrumbs, command bars, context menus, loading/error/empty states, and status bar.

`src/lib/components/settings/`

Settings dialogs and controls. Settings persistence helpers belong in stores or pure helpers, not visual components.

`src/lib/components/ui/`

Generic primitives only. A component does not belong here if only the explorer surface uses it.

`src/lib/components/window/`

Window chrome and frame-level UI.

`src/lib/stores/`

Svelte stores for UI state, session state, workspace state, settings, notifications, dialogs, and action orchestration. Stores may coordinate Tauri calls but must not implement filesystem logic that belongs in Rust.

`src/lib/tauri/`

Typed wrappers around Tauri commands. Components import wrappers from here instead of calling raw `invoke()`.

`src/lib/types/`

Frontend copies of Rust IPC contracts and action types.

`src/lib/utils/`

Pure frontend helpers only. No filesystem access, Tauri invoke calls, or component code.

## Rust And Tauri

`crates/core/`

Portable explorer contracts and logic: IPC types, directory snapshots, job scheduling, cancellation, sorting/filtering/search contracts, and cache-friendly models.

`crates/platform-windows/`

Windows-specific filesystem and shell integration. Windows API details stay here and do not leak into frontend code.

`src-tauri/src/commands/`

Small Tauri command handlers. Commands validate input, call domain services, and serialize results/errors. They should not grow into filesystem engines.

`src-tauri/src/explorer/`

Host-side explorer orchestration that connects commands, core models, and platform services.

## New Top-Level Directories

Adding a new top-level source directory under `src/`, `crates/`, or `src-tauri/src/` requires a one-line entry here before the directory becomes a pattern.

## Cross-Cutting Rules

- Frontend never performs real filesystem work directly.
- Frontend never executes shell commands.
- Tauri command wrappers stay typed.
- Platform-specific code stays behind platform crates or `#[cfg]` gates.
- Security-sensitive boundary changes require an ADR.
