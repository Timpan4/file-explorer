# File Explorer Redesign Brief

## Purpose

Redesign the current custom Windows file explorer so it can serve as a realistic replacement for native Windows Explorer.

The redesign must preserve the strongest parts of the current concept while making it feel:

- native to Windows
- fast and low-overhead
- fully usable in both light mode and dark mode
- modern, but restrained
- more responsive and less visually heavy than the Files app

This document is both a design brief and a long-term reference for future UI work.

---

## Core Product Positioning

This app is **not** supposed to be a flashy alternative file manager.
It is supposed to feel like:

**“the file manager Windows should have shipped: native-feeling, theme-aware, compact, fast, and visually quiet.”**

The design should sit between:

- **Windows Explorer** for familiarity, predictability, and shell-like behavior
- **Files** for visual polish, modern structure, and overall cleanliness

But it must avoid the biggest weakness of Files:

- feeling heavy
- feeling layered
- feeling more like a styled desktop app than a shell component
- being slow

### Guiding product statement

Take the structural familiarity of Explorer, the clarity and polish of Files, strip away most of the decorative weight, and design a UI that feels engineered for speed.

---

## Key Constraints

1. The app must support **light mode and dark mode** as first-class experiences.
2. It must **match the Windows system theme automatically by default**.
3. It should allow a manual theme override in settings.
4. It should feel appropriate as a **daily driver replacement for Explorer**.
5. It should visually communicate **speed, reliability, and low overhead**.
6. The redesign must not assume a web-app aesthetic.
7. The design must stay **compact, dense, and efficient**, without becoming cramped.

---

## Design Principles

### 1. Native familiarity over novelty

Users should immediately understand the app if they know Windows Explorer.

Preserve familiar patterns:

- sidebar-based navigation
- breadcrumb/path bar
- file list behavior
- keyboard shortcuts
- context menu expectations
- selection model
- drag and drop behavior
- rename behavior
- sorting and column logic

### 2. Fast-feeling UI over decorative polish

Every visual decision should support the impression that the app is lightweight and immediate.

Avoid anything that makes the UI feel bloated or sluggish.

### 3. Modern, but restrained

The app should look current, clean, and intentional without becoming glossy, oversized, or overly “app-like.”

### 4. Density with readability

The UI should show a lot of information without looking cluttered.

### 5. Theme parity

Light mode and dark mode must both feel intentionally designed.
Neither should feel like a quick inversion of the other.

---

## High-Level UX Direction

The application should use a classic, Explorer-like structure because that remains the most effective mental model for file navigation.

### Layout

Use a three-part structure:

1. **Left sidebar** for global navigation
2. **Top header area** for movement, actions, and path/search
3. **Main content pane** for current directory contents

Optional panes like preview/details should exist only if enabled and should not complicate the default layout.

---

## Sidebar Design

### Role

The sidebar is for **global navigation context**, not for heavy visual experimentation.

It should contain:

- Home
- Favorites / Quick Access
- Drives
- Optional cloud storage entries
- Optional sections like tags, network, libraries, etc.

### Design direction

The sidebar should feel:

- compact
- structured
- clearly navigational
- lighter than Files in visual weight
- closer to shell UI than app navigation UI

### Rules

- Keep it **fixed-width** and relatively slim
- Use muted section headers
- Use compact rows
- Use clear active and hover states
- Prefer collapsible groups over visual clutter
- Do not over-style with cards, oversized surfaces, or excessive nesting
- Avoid making it look like a website side menu

### Visual hierarchy

- Active item should be obvious but not loud
- Section labels should be secondary
- Icons should support fast scanning
- Spacing should feel efficient, not airy

---

## Header / Toolbar Design

### Role

The header should support navigation and actions without becoming visually heavy.

The recommended structure is **two rows**:

### Row 1: navigation + actions

Include:

- Back
- Forward
- Up
- Refresh
- New tab, if tabs exist
- Contextual file/folder actions if appropriate
- Status indicators aligned to the right

### Row 2: path + search

Include:

- Breadcrumb path bar
- Search field

This is preferred over forcing everything into a single crowded strip.

### Design direction

The top area should feel:

- crisp
- compact
- immediate
- shell-like
- more disciplined than Files

### Rules

- Use small, efficient controls
- Avoid oversized buttons or excessive pill styling
- Use disabled states clearly
- Keep visual noise low
- Avoid decorative chrome

---

## Breadcrumb / Path Bar

### Role

The path bar is one of the most important controls and should support both mouse-driven and keyboard-driven workflows.

### Requirements

- Clickable breadcrumb segments
- Editable path input mode
- Clear current-location emphasis
- Fast transitions between display and edit states

### Design direction

The path bar should feel:

- precise
- familiar
- native to Windows expectations
- more refined than raw text, but not ornamental

### Notes

This area should be treated as a functional control, not a decorative element.

---

## Search

Search should exist because it is useful, not because Explorer has one.

### Requirements

- Placed in the header area, typically alongside the breadcrumb row
- Compact by default
- Visually integrated
- Easy to ignore when not needed
- Should not dominate the layout

### Design direction

Search should feel like part of the shell, not like a web app’s global command box.

---

## Main Content Pane

### Role

This is the core working area and should be the visual center of the entire app.

The main pane should dominate the composition more than the sidebar or header.

### Key requirement

This area must feel:

- instant
- stable
- crisp
- highly scannable
- low overhead

---

## File List / Table View

This is the most important view for the app.
If this feels wrong, the whole product feels wrong.

### Default serious mode

Use a clean list/table view as the main default.

Suggested columns:

- Name
- Type
- Modified
- Size

### Column behavior

- Name should be the widest column
- Size should be right-aligned
- Metadata should be visually de-emphasized
- Column resizing should be supported
- Sorting should be obvious and efficient

### Row behavior

- Compact but readable row height
- Clear hover state
- Strong selected state
- Minimal visual noise
- No unnecessary striping by default
- Sticky header only if it feels native and useful

### Icons

- Simple and fast-loading
- Easy distinction between folders and files
- Symlinks should have a clearer indicator than text alone
- Avoid excessive icon detail if it harms performance or scan speed

### Visual emphasis

- Filenames should be visually strongest
- Type / date / size should be secondary
- Selection must be very clear
- Hover must provide click affordance without becoming distracting

### Design goal

The list should feel more like a native data view than a styled web table.

---

## Tabs

Tabs are acceptable only if they remain cheap and utility-focused.

### If tabs exist, they must be:

- small in visual footprint
- quick to open and switch
- low memory overhead in feeling and behavior
- more like shell tabs than browser tabs

### Avoid

- oversized browser-style tab chrome
- heavy animations
- bloated tab bars
- features that make tabs feel expensive

If tabs feel heavy, they undermine the entire design goal.

---

## Theme Strategy

### Default behavior

The app should automatically match the Windows system theme.

### Also support

- manual override: Light
- manual override: Dark
- optional “Use system accent color” behavior if appropriate

### Important rule

Do not design dark mode first and simply invert it for light mode.

Both themes must preserve the same hierarchy, spacing logic, and product identity.

---

## Dark Mode Direction

Dark mode should feel:

- calm
- precise
- low-glare
- engineered
- contrasty enough for long sessions

### Avoid

- neon accents
- overly blue surfaces everywhere
- excessive glow
- overly soft low-contrast text
- heavy glass or acrylic effects

Dark mode should look modern without becoming flashy.

---

## Light Mode Direction

Light mode should feel:

- crisp
- clean
- native to Windows
- structured without looking sterile

### Avoid

- pure white everywhere
- flat, borderless emptiness
- weak surface hierarchy

Use subtle separation between:

- window background
- sidebar
- toolbar/header
- content pane

Light mode should feel like a first-class shell theme, not a fallback.

---

## Shared Visual System Across Themes

The app should use **layered surfaces**, not just a single background color with text on top.

### Surface levels

Use clear but restrained distinctions between:

- app background
- sidebar surface
- header/toolbar surface
- content surface
- selected state surface

### Visual consistency

The hierarchy should stay stable across both themes.
Only the palette should shift, not the structure or interaction model.

---

## Typography

Typography should be:

- clean
- system-friendly
- compact
- highly legible

### Rules

- Use a modern sans-serif that feels at home on Windows
- Keep primary labels clear and readable
- De-emphasize metadata with weight/color rather than shrinking too aggressively
- Do not make the UI tiny just because it is a power-user app

### Hierarchy

- Primary: filenames, current path, selected content
- Secondary: column headers, control labels, section titles
- Tertiary: metadata, status indicators, minor labels

---

## Color and Accent Use

### Goal

Use color sparingly and purposefully.

### Recommended behavior

- Accent color for selected states, active navigation, and small emphasis points
- Folder/file distinction should be fast and obvious
- Metadata should remain more muted than filenames
- Do not rely on color alone for meaning

### Avoid

- too many accent tones
- loud gradients in the working UI
- decorative color use that competes with content

The actual working interface should be visually quiet.

---

## Interaction Design Requirements

The redesign must preserve or improve key shell interactions.

### Required interaction qualities

- fast hover response
- crisp selection feedback
- intuitive multiselect behavior
- predictable right-click behavior
- inline rename that feels clean and stable
- drag-and-drop affordances
- obvious keyboard focus states

### Behavior philosophy

The interface should feel familiar enough that users do not need to relearn file management.

---

## Performance-Aware Design Rules

This is critical.
The slowness of Files is a primary reason this redesign exists.

Therefore, the design must avoid visual patterns that commonly make desktop apps feel sluggish.

### Avoid

- too many nested surfaces
- excessive translucency
- expensive blur effects
- oversized shadows
- heavy animation
- complex decorative transitions
- overbuilt icon systems
- browser-like chrome if not necessary
- large padded layouts that waste space and scrolling efficiency

### Prefer

- subtle effects only
- flat or lightly layered surfaces
- simple transitions
- compact interaction zones
- strong alignment and hierarchy instead of decoration

### Mental model

The UI should look like it was designed by people who care about frame time.

---

## Relationship to the Files App

Files is an inspiration, not the blueprint.

### Borrow from Files

- modern cleanliness
- good overall structure
- polished proportions
- clear organization
- friendly visual tone

### Do not inherit from Files

- visual heaviness
- extra decorative layering
- too much softness/floatiness
- overbuilt top-level chrome
- anything that makes it feel slow or “styled first, shell second”

### Product interpretation

Do not make “a prettier Files.”
Make “a faster, more native-feeling Explorer replacement that learned the right lessons from Files.”

---

## Relationship to Windows Explorer

Explorer should remain the baseline for behavioral familiarity.

### Keep Explorer strengths

- discoverability
- shell mental model
- navigation familiarity
- low cognitive load
- standard file-management behavior

### Improve on Explorer

- cleaner hierarchy
- modern surface treatment
- more consistent theme behavior
- stronger dark mode
- better polish
- more intentional spacing and typography

---

## Suggested Tone of the Final UI

The final interface should feel:

- native
- capable
- compact
- deliberate
- modern
- calm
- engineered
- fast

It should **not** feel:

- flashy
- playful
- trendy for its own sake
- oversized
- browser-like
- over-animated
- consumer-app glossy

---

## Concrete Design Summary

Design a **modernized Windows Explorer replacement** that automatically follows the system light/dark theme, feels compact and shell-native, and uses Files only as a source of visual polish rather than as a structural or stylistic blueprint. Keep the familiar Explorer mental model, use a flat but refined sidebar, a crisp two-row top area, and a highly optimized main file list built for scan speed. Every design choice should reinforce the impression that the app is lighter, faster, and more dependable than Files.

---

## Instructions for GPT-5.4 / OpenCode

Use this document as the design authority for the redesign.

### Your task

Redesign the current file explorer UI and output a refined design proposal that includes:

1. overall layout direction
2. component-by-component redesign notes
3. light mode guidelines
4. dark mode guidelines
5. hierarchy and spacing rules
6. interaction rules
7. performance-aware visual constraints
8. a concise design system section
9. any recommended simplifications versus the current design

### Important constraints

- Do not redesign it into a generic web app
- Do not make it look like a prettier clone of Files
- Do not sacrifice density or usability for style
- Do not overuse acrylic, blur, glow, or oversized spacing
- Keep it believable as a native daily-use Explorer replacement
- Assume speed and responsiveness are core product values

### Preferred outcome

The output should be specific enough that it can guide implementation and future design decisions, not just offer vague aesthetic advice.

---

## One-Sentence North Star

**Design it like the file manager Windows should have had: native-feeling, theme-aware, compact, calm, modern, and visibly faster than Files.**
