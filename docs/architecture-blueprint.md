# Architecture Blueprint

This document describes the target shape of the code. For the rules around file size, folder ownership, and hygiene, see the [engineering handbook](handbook/).

## Product Direction

File Explorer is a Windows-first Tauri desktop shell with Rust-owned filesystem behavior. The renderer is intentionally thin: it displays typed state, sends typed user intents, and avoids owning filesystem policy.

The core flow is:

```text
User intent -> Svelte UI -> typed Tauri wrapper -> Rust command -> core/platform service -> streamed UI state
```

## Frontend/Rust Boundary

The frontend is a renderer and interaction layer. It must not:

- enumerate directories
- sort or search real directory contents
- hydrate metadata from the filesystem
- execute shell commands
- perform copy, move, rename, delete, recycle, or create-folder operations directly
- block the UI while waiting for filesystem I/O

The Rust side owns:

- directory enumeration
- sorting, filtering, and search for real directories
- metadata contracts
- icon hydration coordination
- cancellation and job scheduling
- file operations
- platform integration

## Rust Workspace Shape

```text
crates/
  core/
    src/
      explorer/
      ipc/
  platform-windows/
    src/
      windows/
src-tauri/
  src/
    commands/
    explorer/
```

Responsibilities:

- `crates/core`: portable explorer contracts, IPC types, job scheduling, snapshot caching, cancellation, pure sort/filter/search logic when it is not platform-specific.
- `crates/platform-windows`: Windows filesystem enumeration, shell metadata, native icon hydration, recycle-bin/context-menu integration, and Windows API boundaries.
- `src-tauri/src/commands`: small Tauri command handlers and validation.
- `src-tauri/src/explorer`: host-side orchestration that wires commands to core and platform services.

Future platform crates such as `platform-macos` or `platform-linux` should match the core contracts rather than forcing the UI to understand platform details.

## Frontend Shape

```text
src/
  lib/
    components/
      explorer/
      settings/
      ui/
      window/
    stores/
    tauri/
    types/
    utils/
  routes/
```

Responsibilities:

- `components/explorer`: Explorer-specific UI shell, panes, rows, command bars, context menus, and status surfaces.
- `components/settings`: settings UI and related controls.
- `components/ui`: generic primitives with no explorer-specific behavior.
- `components/window`: window chrome and app frame.
- `stores`: UI state, session state, workspace state, settings, dialogs, notifications, and action orchestration.
- `tauri`: typed frontend wrappers around Tauri commands.
- `types`: frontend copies of IPC contracts.
- `utils`: pure frontend helpers only.

## Tauri Command Contracts

Every command should have:

- a Rust serde model or existing shared model
- a TypeScript type
- a typed frontend wrapper
- serialized errors suitable for user-facing UI
- cancellation or request identity when it can race navigation

Commands should be narrow. Prefer intent-shaped commands over broad "do anything" payloads.

## Navigation and Refresh

Navigation uses request/job identity so stale results cannot replace current state.

Same-path refresh behavior:

1. Keep the current list visible.
2. Start a replacement snapshot.
3. Stage incoming rows while work is in progress.
4. Swap atomically when the replacement snapshot completes.
5. Preserve selection/focus where the refreshed data still supports it.

Fast refreshes still get confirmation through stable status surfaces, not layout-shifting spinners.

## File Operation Strategy

File operations should flow through Rust commands and future queue orchestration:

- create folder
- rename
- delete/recycle
- copy
- move
- conflict handling
- cancellation
- progress reporting

The UI displays operation state; Rust owns execution and filesystem error handling.

## Performance Budgets

The roadmap owns specific numbers. Architecture must preserve the conditions that make those budgets possible:

- streamed directory deltas
- virtualized lists
- cheap fields before expensive enrichments
- snapshot caching
- cancelable jobs
- no UI-thread sorting/searching for real directories

## Future Extension Points

- dual-pane workspace model
- preview adapters
- archive browsing
- properties and hashes
- Git integration
- cloud providers
- FTP/SFTP
- plugin boundaries
- cross-platform backends

Each extension must define whether it runs on the hot path, how it is canceled, what it caches, and what data crosses the Tauri boundary.
