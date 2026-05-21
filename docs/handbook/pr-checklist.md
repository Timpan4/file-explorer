# PR / Agent Checklist

Run through this before opening a PR or marking an agent task done.

## Verification

- [ ] `bun run check` passes if frontend code changed.
- [ ] `bun run build` passes if build output, routing, or production behavior changed.
- [ ] `cargo check` passes if Rust code changed.
- [ ] Relevant `cargo test` or targeted tests pass if behavior changed.
- [ ] The app starts and the affected flow works if Tauri integration changed.

## Architecture

- [ ] Frontend did not take ownership of filesystem work.
- [ ] New Tauri commands have typed wrappers and typed IPC contracts.
- [ ] Rust code is in the correct crate or host module.
- [ ] Windows-specific code stayed in `crates/platform-windows` or behind `#[cfg(windows)]`.

## UX and Performance

- [ ] Large lists remain virtualized.
- [ ] Same-path refresh does not clear stable content.
- [ ] Loading and status UI does not cause layout shift.
- [ ] No expensive enrichment moved onto the navigation hot path.
- [ ] Keyboard selection and focus rules still match the agent guide.

## Organization

- [ ] New files follow [code-organization.md](code-organization.md).
- [ ] Files crossing the soft caps have a split plan.
- [ ] No hard-cap file grew without being split.
- [ ] Superseded files were deleted.
- [ ] No duplicate component, store, wrapper, or helper was added.

## Tracking

- [ ] Completed roadmap/TODO items were updated.
- [ ] Security-sensitive boundary changes have an ADR under [decisions/](../decisions/).
- [ ] Verification evidence is reported in the final response or PR description.
