# Hygiene

Rules for keeping the codebase free of dead, duplicate, and orphaned code.

## Orphan files

An orphan file is a source file with no inbound import from production code, excluding tests and deliberate examples.

- Delete orphan files in the same change that creates or discovers them.
- Do not keep "for reference" copies. Git history is the reference.
- Do not leave renamed-and-kept stubs unless an external consumer truly depends on the old path.

## Superseding a file

When a change replaces a component, function, store, or module:

- Delete the predecessor in the same change.
- Remove commented-out blocks and placeholder exports.
- Keep transition shims only when there is a real external compatibility reason.

## Duplicate components and helpers

Avoid parallel implementations of the same concept:

- two file list rows
- two context menu systems
- two notification hosts
- two path formatters
- two Tauri wrappers for the same command
- two sort/search implementations

If duplication is intentional during a migration, document the migration endpoint and keep it short-lived.

## Dead code inside a file

- Delete unused imports, unused exports, unreachable branches, and commented-out blocks.
- Do not suppress Rust dead-code warnings without a written reason.
- Do not use TypeScript type escapes to keep dead paths compiling.

## What is deliberately allowed

- TODO comments tied to a roadmap, ADR, or follow-up task.
- Disabled capability flags that are wired through for a documented future feature.
- Small example fixtures when they prove a reusable contract.
