# Docs Index

Documentation for the Windows-first file explorer. Read in roughly this order: product intent first, then architecture constraints, then workflow and tracking.

## Start here

- [Product Vision](product-vision.md): what this app is, who it is for, UX posture, performance posture, and Windows shell expectations.
- [Architecture Blueprint](architecture-blueprint.md): Rust/Svelte/Tauri boundaries, module layout, IPC contracts, and future extension points.
- [Design Brief](../DESIGN.md): visual and interaction authority for the Explorer-like shell.

## Conventions and handbook

- [Engineering Handbook](handbook/): code organization, file-size guidance, hygiene rules, and completion checklist.
- [Development Workflow](development-workflow.md): Bun/Cargo commands, verification expectations, and testing standard.
- [Contributor Guide](../CONTRIBUTING.md): human contributor entry point for setup, scope, checks, and PR expectations.

## Constraints and decisions

- [Architecture Decision Records](decisions/): decisions that require a new ADR to change.
- [Agent Guide](../AGENTS.md): agent-facing rules, command contracts, UX rules, ADR triggers, and verification expectations.

## Work tracking

- [Roadmap](../ROADMAP.md): product phases, performance budgets, and non-negotiables.
- [TODOs](../TODOS.md): near-term implementation backlog.
- [Release Notes and Flow](release.md): maintainer release expectations for future beta builds.

## Reading shortcuts

- Editing UI shell behavior: read [Product Vision](product-vision.md), [Design Brief](../DESIGN.md), and [handbook/code-organization.md](handbook/code-organization.md).
- Editing Rust filesystem behavior: read [Architecture Blueprint](architecture-blueprint.md), [Development Workflow](development-workflow.md), and [decisions/0001-rust-owned-filesystem-boundary.md](decisions/0001-rust-owned-filesystem-boundary.md).
- Finishing an agent task: read [handbook/pr-checklist.md](handbook/pr-checklist.md).
