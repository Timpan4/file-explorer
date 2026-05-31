# File Size And Split Triggers

Long files are harder to review and safer to duplicate by accident. These caps are guidance until a hook enforces them.

## Caps

| Extension | Soft | Hard |
| --- | ---: | ---: |
| `.rs` | 500 lines | 800 lines |
| `.svelte` | 400 lines | 700 lines |
| `.ts` | 300 lines | 600 lines |
| `.css` | 400 lines | 700 lines |

Tests, generated files, declarations, lockfiles, `node_modules/**`, `.svelte-kit/**`, `target/**`, and `src-tauri/target/**` are exempt.

## Meaning

- Soft cap: plan a split the next time the file is touched for structural work.
- Hard cap: split before adding substantial new behavior.

## Split Patterns

Rust:

- Move related command handlers into per-domain files under `src-tauri/src/commands/`.
- Move portable logic into `crates/core` instead of growing Tauri host files.
- Move Windows-only logic into `crates/platform-windows`.
- Keep `mod.rs` files as routing surfaces, not dumping grounds.

Svelte:

- Pull repeated row, header, and dialog pieces into sibling components inside the same feature folder.
- Move pure logic into a store, helper, or `src/lib/utils/` when it is genuinely reusable.
- Keep components focused on rendering and local interaction wiring.

TypeScript:

- Split stores when a state domain gets independent actions and invariants.
- Keep IPC types grouped by domain.
- Keep typed Tauri wrappers small and command-shaped.

## Avoid

- Do not split by line count alone.
- Do not create one-import wrappers just to dodge a cap.
- Do not keep old files around "for reference."
- Do not add a new oversized file and call it legacy.
