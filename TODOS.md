# TODOs

## Immediate

- [ ] Create Rust workspace layout for `core`, `platform-windows`, and `tauri-host` responsibilities.
- [x] Design `DirectoryItem`, `DirectorySnapshot`, `SortSpec`, `SearchQuery`, and file operation contracts.
- [x] Implement a cancellation-aware job system for navigation and enrichment tasks.
- [x] Build streamed directory listing IPC using Tauri channels/events.
- [x] Add a virtualized details view in Svelte.

## Next

- [x] Add keyboard navigation and selection model.
- [x] Add tabs.
- [ ] Add dual-pane state model.
- [x] Add Rust-owned sort, filter, and search paths.
- [ ] Add file operation queue with progress and conflict handling.
- [ ] Add metrics collection for startup, navigation, sort, search, and scroll performance.
- [x] Add developer settings panel for artificial navigation delay and UI testing toggles.
- [x] Add clickable sortable column headers.
- [x] Add selected and unfocused-selected row states.
- [ ] Add native or shell-backed context menu flow.

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
