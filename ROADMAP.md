# Roadmap

## Product Goal

Build a Windows-first file explorer that feels faster than Files by keeping the hot path in Rust and using Tauri only as a renderer host.

## Technical Strategy

- Rust owns directory enumeration, sorting, filtering, search, file operations, archive handling, preview orchestration, caching, and job cancellation.
- Tauri transports intents and incremental state updates.
- Svelte renders panes, tabs, lists, omnibar, menus, and settings without owning file-system logic.
- Windows-specific integrations live behind platform modules so future macOS/Linux support can be added later without rewriting the core.

## Performance Budgets

- Cold start to interactive shell: under 900 ms on a modern desktop.
- Warm folder switch: first visible rows in under 100 ms.
- Large folder navigation: incremental rows immediately, no UI freeze.
- Sort on cached 10k-item directory: under 120 ms.
- Scroll performance in details view: stable 60 fps in virtualized lists.
- Cancellation: stale navigation jobs never overwrite current view state.

## Phase 0 - Foundations

- Define Rust crate boundaries.
- Define IPC model around request ids, job ids, and streamed deltas. Done for the first explorer slice.
- Build benchmark harness for startup, navigation, search, sort, and file operations.
- Lock down renderer-only frontend rules. Done for the current Tauri/Svelte shell.

## Phase 1 - Fast Navigation Core

- Create Rust directory engine with Windows-first enumeration. Done for the current single-pane explorer slice.
- Return cheap item fields first, enrich later.
- Add snapshot cache and cancellation-aware job scheduler. Done.
- Build a virtualized details view in Svelte. Done.
- Support basic selection, focus, keyboard navigation, and breadcrumbs. Done.

## Phase 2 - Productivity Baseline

- Add tabs. Done.
- Add dual pane.
- Add omnibar and command palette shell.
- Add copy, move, rename, delete, recycle bin, and conflict UX.
- Add fast in-folder filtering and sort specs powered by Rust. Done.
- Add advanced/developer settings for artificial navigation delay and UI testing toggles. Done.
- Add developer timing traces for navigation/render visibility. Done for development diagnostics; persistent metrics collection remains open.

## Phase 3 - Rich File Workflows

- Add preview pane with lazy adapters.
- Add archive browsing, extraction, and creation.
- Add file properties and hashes.
- Add session restore and advanced columns.
- Add tags and keyboard remapping.

## Phase 4 - Integrations

- Add Git status and branch actions.
- Add cloud drive providers without polluting core navigation latency.
- Add FTP/SFTP.
- Add third-party integration boundaries and plugin safety rules.

## Phase 5 - Future Portability

- Extract Windows assumptions into platform modules.
- Add portable core tests.
- Introduce macOS/Linux backends only after Windows performance targets are consistently met.

## Non-Negotiables

- No large one-shot folder payloads.
- No non-virtualized large lists.
- No heavy metadata on first paint.
- No UI-thread sorting for real directories.
- No long-running integrations inline with navigation.
