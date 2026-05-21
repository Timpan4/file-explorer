# Product Vision

## Identity

File Explorer is a Windows-first desktop file manager built around a Rust filesystem core and a thin Tauri/Svelte renderer. It is not a generic web app in a desktop wrapper and it is not trying to be a flashy alternative file manager.

The product personality is **native speed with quiet control**: fast enough to feel shell-level, familiar enough for daily Explorer users, and disciplined enough that heavy metadata or integrations never slow down ordinary navigation.

## Product Positioning

The app should feel like the file manager Windows should have shipped: native-feeling, theme-aware, compact, calm, modern, and visibly faster than Files.

Explorer is the behavioral baseline. Files is useful inspiration for cleanliness and polish, but this project must avoid Files' visual heaviness and perceived latency.

## Core Jobs

Three jobs drive feature decisions:

1. Browse local folders quickly, including large directories.
2. Perform everyday file operations with reliable progress, cancellation, and conflict handling.
3. Keep power-user navigation efficient through tabs, panes, keyboard selection, shell actions, and restart-safe session restore.

## Navigation Model

Navigation is path-first and shell-familiar:

```text
Window -> Tab -> Pane -> Directory snapshot -> Selection/focus
```

The current path, selection, and visible rows should remain stable through refreshes. Same-path refreshes stage incoming data and swap atomically only when the replacement snapshot is ready.

The UI should support:

- breadcrumb/path navigation
- keyboard navigation even without a focused row
- `Ctrl+A` selection for visible items
- empty-space click to clear selection
- tabs as lightweight shell utilities
- future dual-pane workflows without changing the core navigation model

## Safety Posture

The app will eventually perform destructive operations. Those actions must be deliberate, typed, and Rust-owned.

- Svelte sends user intent.
- Rust validates and executes filesystem operations.
- UI state reflects progress, cancellation, conflicts, and errors.
- Destructive flows must have clear confirmation or undo/recycle-bin behavior where Windows supports it.

No frontend component should directly perform filesystem operations or shell execution.

## Performance Posture

The app exists because perceived speed matters. The hot path is directory navigation:

- enumerate cheap fields first
- stream incremental rows
- virtualize large lists
- cache snapshots where useful
- cancel stale jobs
- defer heavy enrichments

Features such as thumbnails, Git status, hashes, archive previews, cloud metadata, and network providers are valuable only when they do not pollute first paint or block navigation.

## Visual Emphasis

The default working surface is a compact Explorer-like shell:

- left navigation sidebar
- top navigation/path/search controls
- main virtualized details list
- bottom status bar

The file list is the center of gravity. Filenames should be visually strongest; size, date, type, and secondary metadata should be quieter. Selection, hover, and focus states must be obvious without being loud.

## Theme Strategy

The default theme follows the Windows system theme. Manual light/dark overrides are acceptable, but both modes must feel designed rather than inverted.

Avoid decorative chrome, excessive blur, oversized shadows, loud gradients, and card-heavy layouts. Use restrained layered surfaces and native-feeling controls.

## Near-Term Implications

The next product work should turn the fast single-pane browser into a daily-driver baseline:

- file operation queue with progress, cancellation, and conflict handling
- dual-pane model
- shell-backed context menu flow
- startup/navigation/sort/search/scroll metrics
- full session restore across app restarts

## Long-Term Implications

Later milestones can add:

- preview pane and lazy preview adapters
- archive browsing and creation
- file properties and hashes
- Git state and actions
- cloud providers
- FTP/SFTP
- plugin or extension boundaries
- macOS/Linux platform backends

Each extension follows the same principle: protect local navigation speed, keep file operations Rust-owned, and make integration boundaries explicit.
