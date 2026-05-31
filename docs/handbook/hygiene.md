# Hygiene

Keep the codebase free of dead, duplicate, and orphaned code.

## Orphan Files

An orphan file is a source file with no inbound import from production code, excluding tests and deliberate examples.

- Delete orphan files in the same change that creates or discovers them.
- Do not keep reference copies; Git history is the reference.
- Do not leave renamed stubs unless an external consumer depends on the old path.

## Superseded Code

When a change replaces a component, function, store, or module:

- Delete the predecessor in the same change.
- Remove commented-out blocks and placeholder exports.
- Keep transition shims only when there is a real compatibility reason.

## Duplicate Implementations

Avoid parallel versions of the same concept, such as:

- file list rows
- context menu systems
- notification hosts
- path formatters
- Tauri wrappers for the same command
- sort/search implementations

If duplication is intentional during a migration, document the endpoint and keep the overlap short-lived.

## Dead Code

- Delete unused imports, unused exports, unreachable branches, and commented-out blocks.
- Do not suppress Rust dead-code warnings without a written reason.
- Do not use TypeScript type escapes to keep dead paths compiling.

## Allowed

- TODO comments tied to a roadmap, ADR, or follow-up task.
- Disabled capability flags wired for a documented future feature.
- Small fixtures or examples when they prove a reusable contract.
