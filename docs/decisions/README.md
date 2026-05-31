# Architecture Decision Records

ADRs capture decisions that should not change accidentally during normal feature work.

## Current ADRs

- [0001: Rust-Owned Filesystem Boundary](0001-rust-owned-filesystem-boundary.md)

## Add An ADR Before Changing

- the frontend/Rust filesystem boundary
- Tauri capabilities or plugin permissions
- shell command execution policy
- destructive file operation behavior
- cross-platform backend abstractions
- plugin or extension execution model
- persistent storage of filesystem metadata, previews, hashes, or history
- network, cloud, FTP/SFTP, or Git integrations that can affect navigation latency or credentials

Keep ADRs short: context, decision, consequences.
