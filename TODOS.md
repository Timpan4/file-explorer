# TODOs

## Immediate

- [ ] Create Rust workspace layout for `core`, `platform-windows`, and `tauri-host` responsibilities.
- [ ] Design `DirectoryItem`, `DirectorySnapshot`, `SortSpec`, `SearchQuery`, and file operation contracts.
- [ ] Implement a cancellation-aware job system for navigation and enrichment tasks.
- [ ] Build streamed directory listing IPC using Tauri channels/events.
- [ ] Add a virtualized details view in Svelte.

## Next

- [ ] Add keyboard navigation and selection model.
- [ ] Add tabs and dual-pane state model.
- [ ] Add Rust-owned sort, filter, and search paths.
- [ ] Add file operation queue with progress and conflict handling.
- [ ] Add metrics collection for startup, navigation, sort, search, and scroll performance.

## After Core Speed Lands

- [ ] Add preview pipeline with lazy adapters.
- [ ] Add archive support.
- [ ] Add properties and hashes.
- [ ] Add tags, command palette, and shortcut remapping.
- [ ] Add session restore.

## Later Integrations

- [ ] Add Git integration.
- [ ] Add cloud provider adapters.
- [ ] Add FTP/SFTP.
- [ ] Define extension boundaries that cannot block folder navigation.
