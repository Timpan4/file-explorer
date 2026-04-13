# Project Agent Rules

These rules capture recurring implementation decisions for `file-explorer`.

## Product UX Rules

- Treat this as a Windows-first daily-driver file explorer, not a generic web app.
- Match the system light/dark theme automatically by default.
- Keep the shell visually closer to Files/Explorer than to dashboard-style web UIs.
- Prefer compact, scan-friendly layouts over decorative styling.

## Refresh And Loading Rules

- Refreshing the current folder must keep the current list visible until the replacement snapshot completes.
- Same-path refreshes should stage incoming items and swap them in atomically on completion.
- Do not clear the list for a same-path refresh.
- Suppress transient loading UI for fast operations with a debounce.
- Use subtle progress indication and skeletons instead of emptying stable content.
- Footer/header loading text should avoid flicker on very fast operations.

## Interaction Rules

- Explorer chrome should not allow text selection except in real text inputs.
- `Ctrl+A` inside the explorer shell should select visible items unless focus is in a text input.
- Clicking empty list space should clear selection and focus outline.
- Do not auto-focus the first row on load or reload.
- Keep keyboard navigation working even when no row is currently focused.

## Layout Rules

- Keep nav controls, address bar, and search on one line.
- Keep footer status in the bottom status bar, not the header.
- Avoid layout shifts for transient controls or statuses.
- Keep small gutters around list rows so future marquee selection has visual breathing room.

## Feedback Rules

- Fast refreshes still need visible confirmation.
- Reuse stable button slots instead of adding/removing controls during short-lived states.
- Prefer subtle, native-feeling motion over flashy transitions.
