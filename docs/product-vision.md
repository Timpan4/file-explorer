# Product Vision

## Identity

File Explorer is a Windows-first desktop file manager with a Rust filesystem core and a thin Tauri/Svelte renderer. It is not a generic web app in a desktop wrapper and not a flashy alternative shell.

The product personality is native speed with quiet control: shell-level responsiveness, Explorer familiarity, and enough discipline that heavy metadata never slows ordinary navigation.

## Positioning

The app should feel like the file manager Windows should have shipped: native-feeling, theme-aware, compact, calm, modern, and visibly faster than Files.

Explorer is the behavioral baseline. Files is useful inspiration for polish, but this project must avoid Files' visual heaviness and perceived latency.

## Core Jobs

1. Browse local folders quickly, including large directories.
2. Perform everyday file operations with reliable progress, cancellation, and conflict handling.
3. Keep power-user navigation efficient through tabs, panes, keyboard selection, shell actions, and restart-safe session restore.

## Navigation Model

Navigation is path-first and shell-familiar:

```text
Window -> Tab -> Pane -> Directory snapshot -> Selection/focus
```

The current path, selection, focus, and visible rows should remain stable through refreshes. Same-path refresh stages incoming data and swaps atomically only when the replacement snapshot is ready.

The UI should support:

- breadcrumb and editable path navigation
- keyboard navigation even without a focused row
- `Ctrl+A` selection for visible items
- empty-space click to clear selection and focus outline
- lightweight tabs
- future dual-pane workflows without changing the core model

## Safety

The app will manipulate real user files. Destructive actions must be deliberate, typed, and Rust-owned.

- Svelte sends user intent.
- Rust validates and executes filesystem operations.
- UI state reflects progress, cancellation, conflicts, and errors.
- Destructive flows need clear confirmation or recycle-bin/undo behavior where Windows supports it.

No frontend component should perform filesystem work or shell execution directly.

## Performance

The hot path is directory navigation:

- enumerate cheap fields first
- stream incremental rows
- virtualize large lists
- cache snapshots where useful
- cancel stale jobs
- defer heavy enrichments

Thumbnails, Git status, hashes, archive previews, cloud metadata, and network providers are valuable only when they stay off first paint and remain cancelable.

## Visual Direction

The default working surface is a compact Explorer-like shell:

- left navigation sidebar
- top navigation, path, and search controls
- main virtualized details list
- bottom status bar

The file list is the center of gravity. Filenames should be strongest; size, date, type, and secondary metadata should be quieter. Selection, hover, and focus states must be clear without being loud.

## Theme

The default theme follows the Windows system theme. Manual light/dark overrides are acceptable, but both modes must feel designed rather than inverted.

Avoid decorative chrome, excessive blur, oversized shadows, loud gradients, and card-heavy layouts. Use restrained surfaces and native-feeling controls.

## Near-Term Direction

The next product work should turn fast single-pane browsing into a daily-driver baseline:

- queued copy/move operations with progress, cancellation, and conflict handling
- dual-pane model
- shell-backed context menu flow
- startup, navigation, sort, search, and scroll metrics
- full session restore across app restarts

## Long-Term Direction

Later milestones can add:

- preview pane and lazy preview adapters
- archive browsing and creation
- file properties and hashes
- Git state and actions
- cloud providers
- FTP/SFTP
- plugin or extension boundaries
- macOS/Linux platform backends

Every extension follows the same rule: protect local navigation speed, keep file operations Rust-owned, and make integration boundaries explicit.
