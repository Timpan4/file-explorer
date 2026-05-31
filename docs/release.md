# Releases

The project is not yet managed as a packaged beta. This document defines the expected maintainer flow once installers are published.

## Release Readiness

A release candidate should have:

- passing `bun run check`
- passing `bun run build`
- passing `cargo check`
- passing relevant `cargo test` coverage
- a manual Tauri smoke test on Windows
- updated roadmap/TODO tracking for completed scope
- no known navigation, refresh, or destructive file-operation regressions

## Maintainer Flow

1. Update versions in `package.json`, `src-tauri/tauri.conf.json`, and Rust manifests as needed.
2. Update release notes or changelog when one exists.
3. Run the release readiness checks.
4. Build the Tauri bundle.
5. Smoke test the installer or built app on Windows.
6. Publish only after artifact checks pass.

## Publishing Checklist

- Confirm Windows artifacts exist and launch.
- Confirm basic navigation works in user directories.
- Confirm large folder navigation remains responsive.
- Confirm rename/delete/create-folder flows behave as expected if touched.
- Confirm missing or inaccessible folders produce understandable errors.
- Confirm no debug-only artificial delay or tracing setting is enabled by default.

Future macOS/Linux releases should wait until platform backends are intentionally supported.
