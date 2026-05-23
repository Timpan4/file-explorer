# ADR 0001: Rust-Owned Filesystem Boundary

## Status

Accepted.

## Context

The app browses large folders, manipulates real user files, integrates with Windows shell behavior, and will eventually coordinate previews, archives, Git state, cloud providers, and network filesystems.

If the frontend owns filesystem behavior, the product becomes harder to secure, harder to cancel correctly, and easier to slow down with renderer-thread work.

## Decision

Rust owns filesystem behavior.

- Svelte renders typed state and sends typed user intent.
- Tauri commands are the only path from UI intent to filesystem work.
- Directory enumeration, sorting, filtering, search, metadata hydration, and file operations live in Rust.
- Windows-specific filesystem and shell integration lives in `crates/platform-windows`.
- The renderer never executes arbitrary shell commands.
- Expensive enrichments stay off the navigation hot path.

## Consequences

This boundary adds plumbing compared with a typical desktop webview app. In return, navigation can stay fast, cancellation can be reliable, and future platform backends can share the same core contracts.

Changing this boundary requires a new ADR.
