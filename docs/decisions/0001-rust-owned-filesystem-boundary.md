# ADR 0001: Rust-Owned Filesystem Boundary

## Status

Accepted.

## Context

The app is a desktop file explorer. It will browse large folders, manipulate real user files, integrate with Windows shell behavior, and eventually coordinate previews, archives, Git state, cloud providers, and network filesystems.

If the frontend owns filesystem behavior, the product becomes harder to secure, harder to make cancelable, and easier to slow down with renderer-thread work.

## Decision

The Rust side owns filesystem behavior.

- Svelte renders typed state and sends typed user intents.
- Tauri commands are the only path from UI intent to filesystem work.
- Directory enumeration, sorting, filtering, search, metadata hydration, and file operations live in Rust.
- Windows-specific filesystem and shell integration lives in `crates/platform-windows`.
- The renderer never executes arbitrary shell commands.
- Expensive enrichments stay off the navigation hot path.

## Consequences

This creates a stricter boundary than a typical desktop webview app. It may take more plumbing to add features, but navigation stays faster, cancellation is reliable, and future platform backends can share the same core contracts.

Changing this boundary requires a new ADR.
