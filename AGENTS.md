# Agent Guide

This repository is a Windows-first desktop file explorer built with Tauri 2, SvelteKit, TypeScript, Bun, Rust, and Windows shell integration.

Before making implementation changes, skim the [docs index](docs/README.md). The minimum reading set is:

- `docs/product-vision.md`
- `docs/architecture-blueprint.md`
- `docs/development-workflow.md`
- `docs/handbook/README.md`
- `docs/decisions/` when touching locked-in boundaries

## Core Constraints

- Keep the filesystem hot path in Rust.
- Keep Svelte as a thin renderer for state already shaped by Rust.
- Do not let frontend code own sorting, searching, metadata hydration, or file operations.
- Do not block the UI on filesystem calls.
- Do not add non-virtualized large lists.
- Keep expensive enrichments off navigation first paint: thumbnails, Git state, hashes, previews, cloud metadata, archive inspection, and network providers.
- Keep Windows native integration in `crates/platform-windows` behind platform boundaries.
- Preserve restart-safe and cancellation-aware navigation semantics: stale jobs must not overwrite the current view.
- Do not auto-focus the first row on load or reload.

## Preferred Architecture

Rust owns explorer behavior. Svelte renders the shell.

- `crates/core`: IPC types, directory contracts, job scheduling, snapshot caching, cancellation, pure explorer logic.
- `crates/platform-windows`: Windows-only filesystem integration, icon hydration, shell APIs, and future native context menu hooks.
- `src-tauri`: Tauri host, commands, event emission, application wiring.
- `src/`: SvelteKit UI shell, typed Tauri wrappers, stores, and components. No direct filesystem behavior.

Frontend code should call typed wrappers under `src/lib/tauri/`. Tauri commands should expose serde-friendly contracts from Rust crates or host modules. New IPC contracts need matching Rust and TypeScript types.

## File Organization

The engineering handbook at [docs/handbook/](docs/handbook/) is the source of truth for code organization, file size, and hygiene. Skim its [README](docs/handbook/README.md) before making structural changes.

Quick rules:

- Feature-specific Svelte UI goes under `src/lib/components/<area>/` and related stores under `src/lib/stores/`.
- Generic UI primitives stay under `src/lib/components/ui/`.
- Typed frontend command wrappers stay under `src/lib/tauri/`.
- Shared frontend types stay under `src/lib/types/`.
- Rust explorer contracts and scheduling stay in `crates/core`.
- Windows shell and filesystem code stays in `crates/platform-windows`.
- Tauri command handlers stay under `src-tauri/src/commands/`; orchestration that is not a command handler belongs in a domain module such as `src-tauri/src/explorer/`.
- A new top-level source directory needs a one-line entry in [docs/handbook/code-organization.md](docs/handbook/code-organization.md).

Run through [docs/handbook/pr-checklist.md](docs/handbook/pr-checklist.md) before claiming implementation work complete.

## Implementation Style

- Prefer existing patterns over invention.
- Keep changes scoped and reviewable.
- Add abstractions only when they remove real duplication or protect a boundary already documented here.
- Use Bun for frontend package management and scripts.
- Commit `bun.lock` when frontend dependencies change.
- Do not introduce dependencies without verifying the current stable version from an authoritative source and confirming they fit the project.
- Do not add duplicate router, state, virtual list, command-wrapper, styling, or filesystem libraries without an ADR.
- Add tests or checks where risk justifies them.
- Use clear type names that match the docs unless there is a good reason to change them.
- Add comments only for non-obvious architecture decisions.
- Add TODOs for future features without implementing them early.

## Quality Rules

TypeScript:

- No `as any`.
- No `@ts-ignore`.
- No `any` in function signatures.
- No empty `catch` blocks.
- No raw Tauri `invoke()` calls from components.

Rust:

- No `unwrap()` on `Result` in hot paths; propagate or handle.
- New workspace crates need serde serialization for IPC contracts.
- Platform-specific code stays behind `#[cfg(windows)]` gates or platform crates.
- Long-running work must be cancellation-aware when it can race navigation.

General:

- UI never blocks on filesystem calls; all I/O goes through Rust via IPC.
- All file operations initiated by UI emit through Rust commands.
- Same-path refresh stages incoming items and swaps atomically on completion; do not clear the list.
- Fast operations still need visible confirmation without flicker.

## Product UX Rules

Theme and visual style:

- Windows-first daily-driver shell, not a generic web app.
- Match system light/dark theme automatically by default.
- Visual style should sit closer to Explorer and Files than to dashboard UIs.
- Keep layouts compact, scan-friendly, and quiet.
- Do not use decorative cards, loud gradients, heavy blur, or web landing-page patterns in the working shell.

Refresh and loading:

- Same-path refresh keeps the current list visible until the replacement snapshot completes.
- Suppress transient loading UI with debounce.
- Use subtle progress indication and skeletons over emptying stable content.
- Loading text belongs in stable header/footer slots and must avoid layout shifts.

Interaction:

- Explorer chrome should not allow text selection except in real text inputs.
- `Ctrl+A` selects visible items unless focus is in a text input.
- Clicking empty list space clears selection and focus outline.
- Keyboard navigation works even when no row is currently focused.
- Right-click, rename, selection, and drag/drop should follow Windows shell expectations.

Layout:

- Navigation controls, address bar, and search stay in a compact top area.
- Footer status belongs in the bottom status bar, not the header.
- Avoid layout shifts for transient controls or statuses.
- Keep small gutters around list rows so marquee selection has visual breathing room.

Feedback:

- Reuse stable button slots instead of adding/removing controls during short-lived states.
- Prefer subtle, native-feeling motion over flashy transitions.
- Errors should explain the failed filesystem action without exposing irrelevant internal details.

## Performance Rules

- Navigation is incremental, cancelable, and benchmarked against [ROADMAP.md](ROADMAP.md) budgets.
- Large lists are virtualized from day one.
- Warm folder switches should show first visible rows quickly from cache or streamed deltas.
- Stale navigation jobs never overwrite current view state.
- Sorting and filtering for real directories stay Rust-owned.
- Expensive enrichments are scheduled after the hot path and can be canceled.

## Tauri Command Contracts

- Every frontend filesystem operation goes through a typed wrapper in `src/lib/tauri/`.
- Every new Tauri command needs a Rust serde model, a TypeScript type, and a typed frontend wrapper.
- Command errors must serialize into user-visible application errors.
- Do not add broad command payloads that expose arbitrary filesystem contents beyond the requested user action.
- Do not add shell execution or process-spawning command surfaces without an ADR.

## Security-Sensitive Changes

Write an ADR before changing:

- the frontend/Rust filesystem boundary
- Tauri capabilities or plugin permissions
- shell command execution policy
- destructive file operation behavior
- cross-platform backend abstractions
- plugin or extension execution model
- persistent storage of filesystem metadata, previews, hashes, or history
- network, cloud, FTP/SFTP, or Git integrations that can affect navigation latency or credentials

## Verification

- Run the relevant checks before claiming work complete.
- Frontend changes should pass `bun run check`.
- Production build changes should pass `bun run build` when practical.
- Rust backend changes should pass `cargo check`.
- Rust behavior changes should run `cargo test` or a targeted crate test.
- Tauri integration changes should be smoke tested with `bun run tauri dev` when practical.
- If a check cannot run, state the exact blocker and what remains unverified.
- When completing roadmap work, update the corresponding item in [ROADMAP.md](ROADMAP.md) or [TODOS.md](TODOS.md).

## Git Workflow

Before any git write, run:

```sh
git branch --show-current
```

If the current branch is `gitbutler/workspace`, this repo is in GitButler mode:

- Use `but` for all git writes.
- Never use raw `git add`, `git commit`, `git push`, `git checkout`, `git rebase`, `git merge`, or `git stash`.
- Use `but diff --no-tui` for diffs.
- Do not leave the workspace branch.
- If `but` is missing or unclear, run `but --help`; do not fall back to raw git writes.
- Before `but` commit, disable GitButler credit unless requested: `git config --local gitbutler.gitbutlerCommitter 0`.
- Create PRs through `but pr new` when PR creation is requested.

Outside GitButler mode, normal non-destructive git rules apply.

Naming and commit rules:

- Branch names use `feat/`, `fix/`, `refactor/`, `docs/`, `test/`, `chore/`, or `perf/` plus a concrete 2-6 word kebab-case slug.
- Avoid vague branch names such as `tmp`, `misc`, `updates`, `stuff`, or ticket-only names.
- Commit subjects should state one concrete outcome.
- Add a short commit body only when the why is not obvious.
- Do not add AI or coauthor attribution unless requested.
- Avoid unrelated formatting churn.
- Do not rewrite user changes.
- Do not force push, amend, or rewrite history unless explicitly requested and safe.
