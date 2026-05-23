# Design Brief

This document is the design authority for the file explorer shell.

## North Star

Design it like the file manager Windows should have had: native-feeling, theme-aware, compact, calm, modern, and visibly faster than Files.

## Positioning

The app is not a flashy alternative file manager and not a generic web app in desktop clothing. It should feel like Explorer's familiar shell model rebuilt with sharper hierarchy, better theme handling, and less latency.

Use:

- Windows Explorer for behavior, predictability, and shell familiarity.
- Files for polish, cleanliness, and modern proportions.

Avoid inheriting Files' visual heaviness, soft layering, and slow-feeling chrome. The interface should look engineered for speed.

## Hard Constraints

- Light and dark mode are first-class.
- The default theme follows the Windows system theme.
- A manual light/dark override may live in settings.
- The app must be credible as a daily Explorer replacement.
- Density matters, but the UI must not feel cramped.
- The working shell must not look like a website, dashboard, or marketing page.

## Layout

Use the classic file-manager structure:

- left sidebar for global navigation
- compact top area for navigation, actions, path, and search
- main content pane for the current directory
- bottom status bar for counts, progress, and stable feedback

Optional preview or details panes should be opt-in and should not complicate the default layout.

## Sidebar

The sidebar provides global navigation context. It should contain Home, Favorites or Quick Access, drives, and future optional entries such as cloud storage, libraries, network, or tags.

Rules:

- Keep it fixed-width, slim, and structured.
- Use compact rows and muted section labels.
- Make active and hover states obvious but quiet.
- Prefer collapsible groups over extra nesting.
- Do not use cards, oversized surfaces, or website-style navigation.

## Header

Use a compact two-row header when space allows.

Row 1: navigation and actions.

- Back
- Forward
- Up
- Refresh
- New tab when tabs are enabled
- contextual file or folder actions
- stable status indicators aligned to the right

Row 2: path and search.

- breadcrumb path bar
- editable path mode
- compact search field

Rules:

- Controls should be small, clear, and native-feeling.
- Disabled states must be visible.
- Do not use oversized pill buttons, decorative chrome, heavy blur, or flashy transitions.

## Path And Search

The path bar is a primary control, not decoration.

It must support:

- clickable breadcrumb segments
- fast edit mode
- clear current-location emphasis
- keyboard-driven navigation

Search should be compact, integrated with the header, and easy to ignore when not needed. It should not look like a web app command box unless the product intentionally adds an omnibar.

## File List

The details list is the center of gravity. If it feels wrong, the product feels wrong.

Default columns:

- Name
- Type
- Modified
- Size

Rules:

- Name is the widest and strongest column.
- Size is right-aligned.
- Metadata is visually quieter than filenames.
- Rows are compact but readable.
- Hover, selected, unfocused-selected, and keyboard focus states are clear.
- Avoid default striping unless it proves useful.
- Use a sticky header only if it feels native and helps scanning.
- Large lists must stay virtualized.

Icons should load fast, distinguish files and folders clearly, and show special states such as symlinks without relying on text alone.

## Tabs

Tabs are utility chrome, not browser chrome.

Rules:

- Keep tabs small and quick to scan.
- Switching should feel cheap.
- Avoid heavy animations, oversized tab bars, and features that make each tab feel expensive.

## Theme

Both themes need deliberate palettes. Do not design dark mode first and invert it.

Use restrained surface levels:

- app background
- sidebar surface
- header surface
- content surface
- selected state surface

Dark mode should be calm, precise, low-glare, and sufficiently contrasty for long sessions. Avoid neon accents, glow, all-blue surfaces, and glass effects.

Light mode should be crisp, clean, and structured. Avoid pure-white emptiness, weak hierarchy, and borderless flatness.

## Typography And Color

Use system-friendly sans-serif typography. Keep hierarchy compact:

- primary: filenames, current path, selected content
- secondary: column headers, controls, section labels
- tertiary: metadata, counts, minor status

Use color sparingly:

- accent color for selected state, active navigation, and small emphasis
- muted metadata
- clear folder/file distinction
- no decorative gradients in the working shell
- no color-only meaning

## Interaction

Preserve Windows shell expectations:

- fast hover response
- crisp selection feedback
- intuitive multi-select
- predictable right-click behavior
- stable inline rename
- drag and drop affordances
- obvious keyboard focus states
- keyboard navigation even when no row is focused

Users should not need to relearn file management.

## Performance-Aware Visual Rules

The UI should look like it was designed by people who care about frame time.

Avoid:

- nested decorative surfaces
- excessive translucency or blur
- oversized shadows
- heavy animation
- complex transitions
- overbuilt icon systems
- browser-like chrome
- airy layouts that reduce scan efficiency

Prefer:

- flat or lightly layered surfaces
- subtle motion
- compact hit areas with enough breathing room
- strong alignment and hierarchy
- stable status slots that do not shift layout

## Implementation Guidance

Future UI proposals should specify:

- layout changes
- component-level behavior
- light and dark theme treatment
- spacing and hierarchy rules
- interaction states
- performance risks
- simplifications compared with the current UI

Keep the result specific enough to guide implementation, not just aesthetic preference.
