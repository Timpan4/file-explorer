# Roadmap

## Product Goal

Build a Windows-first file explorer that feels faster than Files by keeping the hot path in Rust and using Tauri/Svelte as a thin desktop shell.

## Reading Context

- [Product Vision](docs/product-vision.md): product identity and UX posture.
- [Architecture Blueprint](docs/architecture-blueprint.md): target module boundaries.
- [Design Brief](DESIGN.md): visual and interaction authority.
- [Development Workflow](docs/development-workflow.md): verification standard.

## Technical Strategy

- Rust owns directory enumeration, sorting, filtering, search, file operations, archive handling, preview orchestration, caching, and job cancellation.
- Tauri transports typed intents and incremental state updates.
- Svelte renders panes, tabs, lists, path controls, menus, dialogs, and settings without owning filesystem logic.
- Windows-specific integrations live behind platform modules so future macOS/Linux support can be added later without rewriting the core.
- Expensive enrichments stay off the navigation hot path and must be cancelable when they can race navigation.

## Performance Budgets

- Cold start to interactive shell: under 900 ms on a modern desktop.
- Warm folder switch: first visible rows in under 100 ms.
- Large folder navigation: incremental rows immediately, no UI freeze.
- Sort on cached 10k-item directory: under 120 ms.
- Scroll performance in details view: stable 60 fps in virtualized lists.
- Cancellation: stale navigation jobs never overwrite current view state.

## Phase 0: Foundations

Goal: establish the repo and architecture boundary for a Rust-owned explorer.

- [x] Define Rust crate boundaries.
- [x] Define IPC model around request ids, job ids, and streamed deltas for the first explorer slice.
- [ ] Build benchmark harness for startup, navigation, search, sort, and file operations.
- [x] Lock down renderer-only frontend rules for the current Tauri/Svelte shell.
- [x] Add Kubecove-style docs, handbook, and ADR structure.

## Phase 1: Fast Navigation Core

Goal: make local directory navigation fast, incremental, and stable.

- [x] Create Rust directory engine with Windows-first enumeration for the current single-pane explorer slice.
- [x] Return cheap item fields first and enrich later.
- [x] Add snapshot cache and cancellation-aware job scheduler.
- [x] Build a virtualized details view in Svelte.
- [x] Support basic selection, focus, keyboard navigation, and breadcrumbs.
- [x] Add Rust-owned in-folder filtering and sort specs.

## Phase 2: Productivity Baseline

Goal: become useful as a daily-driver shell for common file work.

- [x] Add tabs.
- [ ] Add dual-pane state model.
- [ ] Add omnibar and command palette shell.
- [ ] Add copy, move, rename, delete, recycle bin, and conflict UX.
- [x] Add developer settings for artificial navigation delay and UI testing toggles.
- [x] Add developer timing traces for navigation/render visibility.
- [ ] Add persistent metrics collection for startup, navigation, sort, search, and scroll budgets.
- [ ] Add native or shell-backed context menu flow.
- [ ] Add full session restore across app restarts.

## Phase 3: Rich File Workflows

Goal: add deeper file management without slowing the navigation hot path.

- [ ] Add preview pane with lazy adapters.
- [ ] Add archive browsing, extraction, and creation.
- [ ] Add file properties and hashes.
- [ ] Add advanced columns.
- [ ] Add tags.
- [ ] Add keyboard remapping.

## Phase 4: Integrations

Goal: add optional external context behind explicit boundaries.

- [ ] Add Git status and branch actions.
- [ ] Add cloud drive providers without polluting core navigation latency.
- [ ] Add FTP/SFTP.
- [ ] Define third-party integration boundaries and plugin safety rules.
- [ ] Add ADRs for any integration that touches credentials, shell execution, or the navigation hot path.

## Phase 5: Future Portability

Goal: preserve Windows excellence while making future platform backends possible.

- [ ] Extract remaining Windows assumptions into platform modules.
- [ ] Add portable core tests.
- [ ] Define platform backend contracts.
- [ ] Introduce macOS/Linux backends only after Windows performance targets are consistently met.

## Cross-Cutting Tracks

### Safety and File Operations

- [x] Keep frontend filesystem behavior behind Tauri commands.
- [x] Keep first navigation slice Rust-owned.
- [ ] Make destructive operations queue-aware and progress-reporting.
- [ ] Prefer recycle-bin behavior where Windows supports it.
- [ ] Add ADR before exposing broad shell execution or plugin execution.

### UX and Shell Fidelity

- [x] Match system light/dark theme by default.
- [x] Keep the main list virtualized.
- [x] Keep same-path refresh stable rather than clearing the list.
- [ ] Add shell-native context menu behavior.
- [ ] Add drag/drop affordances.
- [ ] Add dual-pane workflows.

### Agent and Maintainer Discipline

- [x] Add docs index and agent guide.
- [x] Add engineering handbook.
- [x] Add architecture decision records directory.
- [ ] Add checked-in pre-commit or validation hook if the repo starts needing enforced size/secrets checks.
- [ ] Keep roadmap/TODO items updated as milestones land.

## Non-Negotiables

- No large one-shot folder payloads.
- No non-virtualized large lists.
- No heavy metadata on first paint.
- No UI-thread sorting for real directories.
- No long-running integrations inline with navigation.
- No frontend-owned filesystem operations.
