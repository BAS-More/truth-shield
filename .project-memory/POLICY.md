# Comprehensive project memory

This is an agent-readable bootstrap and working policy, version 1.
A Markdown file does not execute an installer. Reading this file does not mean
the project has been indexed, the hooks are active, or validation has passed.

## Preserve the project

Read the existing README, AGENTS/CLAUDE instructions, mandatory first-read files
and current handover before implementation. Preserve their entry order, active
work, licenses, approvals, dependency policy and existing hooks. Append or merge
this policy; never replace unrelated instructions. More specific repository
rules still apply.

Confirm the actual repository root, remote, branch, commit and working-tree
changes. Use an explicit target repository. Do not recursively process a parent
folder containing other projects, dependencies, caches or customer data.

## First use and setup choice

1. Look for an existing graph catalog, setup guide, graph commands, MCP
   registration, hooks and recorded setup choice.
2. If the owner already authorized setup for this repository, continue that
   setup without asking again. If no choice is recorded, offer comprehensive
   project memory once before installing it. Record enabled, deferred or declined
   and honor that choice until the owner changes it.
3. If a verified installation exists, use it. Do not create another index or
   replace its pinned tool revision merely because this template is present.
4. If setup is incomplete, inspect the actual blocker. Continue useful
   source/documentation work when permitted, but do not certify missing graphs,
   missing tools or unexecuted checks as available or passed.

The owner has requested this workflow across their existing repositories.
Apply that authorization within the repository/task scope actually given to
the agent. Future projects should be offered the option. Batch setup is allowed
within the owner's confirmed rollout scope; do not enroll unrelated repositories.

## Reference implementation

Use these exact MAH sources as a reviewed reference when adapting the setup:

- [Agent workflow](https://github.com/BAS-More/MAH/blob/688eee19709632f1a5fb6900184ff89217dddea1/AGENTS.md)
- [Setup and maintenance](https://github.com/BAS-More/MAH/blob/688eee19709632f1a5fb6900184ff89217dddea1/docs/agent-context/setup.md)
- [Graph scripts](https://github.com/BAS-More/MAH/tree/688eee19709632f1a5fb6900184ff89217dddea1/scripts/graphs)
- [CLI entry point](https://github.com/BAS-More/MAH/blob/688eee19709632f1a5fb6900184ff89217dddea1/scripts/knowledge-graph.mjs)
- [Recorded inventory](https://github.com/BAS-More/MAH/blob/688eee19709632f1a5fb6900184ff89217dddea1/docs/agent-context/generated/README.md)
- [Analyzer pin](https://github.com/BAS-More/MAH/blob/688eee19709632f1a5fb6900184ff89217dddea1/tools/knowledge-graph.json)
- [Semantic model manifest](https://github.com/BAS-More/MAH/blob/688eee19709632f1a5fb6900184ff89217dddea1/tools/semantic-model.json)

Reference MAH commit: `688eee19709632f1a5fb6900184ff89217dddea1`.
Reference analyzer: `BAS-More/knowledge-graph` commit
`557277c88feafbfd8b232ceacfda59d64b61ef81`.

These pins establish provenance; they are not a claim that old dependencies
remain free of vulnerabilities. Audit them under the target repository's policy.
Adopt updates only with recorded compatibility and validation evidence.

MAH's implementation includes project-specific TypeScript modules, PostgreSQL
migrations, hierarchy definitions, contracts and workflow paths. Adapt those
extractors to the target sources. Copying MAH's generated files, identifiers,
counts, fingerprints or database/hierarchy definitions is not installation.

## Bootstrap work required

Prepare a small target-repository configuration recording identity, supported
languages, source and documentation roots, exclusions, tool/model pins, graph
scopes, setup choice and explicit not-applicable reasons. This is a design
requirement; this template does not ship a generic config parser or installer.

Implement or adopt a reviewed, repeatable installer that:
- audits and installs locked developer tooling separately from application
  runtime dependencies;
- verifies tool/model revisions and asset sizes/hashes;
- preserves existing instructions, package-manager scripts, MCP settings and
  hooks, and produces a reviewable diff;
- generates graphs from this repository and exposes documented session, context,
  impact, change-detection, refresh and verification commands;
- uses explicit repository paths and keeps each checkout's index isolated;
- resumes verified completed steps and stops with an actionable error when a
  prerequisite fails, without endless installation/encoding/retry loops;
- requires no broad Windows ACL changes or Docker Desktop installation.

Use the repository's existing command conventions. The following are the MAH
reference command names, not commands supplied by adding this Markdown file:

`graph:setup`, `graph:runtime`, `graph:model`, `graph:refresh`,
`graph:session`, `graph:test`, `graph:test:runtime`, `graph:check`,
`graph:watch`, and the `graph` context/impact/change-detection interface.

Document the actual installed commands in the target README and setup guide.

## Coverage required

Record every applicable view and its extraction limits:

| View | Evidence to derive from this repository |
| --- | --- |
| Structural | Files, symbols, calls and references |
| Dependencies | Manifests, lockfiles and resolved package relationships |
| Modules | Language-aware import/export and module resolution |
| Database | Declared schema and migrations using the target database/ORM |
| Processes | Detected execution flows and functional communities |
| Hierarchy | Actual agent/component ownership and orchestration, if present |
| Semantic | Local embeddings of allowed source and durable documentation |
| Contracts | Source sites for HTTP, MCP, events or other declared interfaces |
| Workflows | Build, test, release and deployment definitions |

A genuinely absent capability may be marked not applicable with source evidence.
An existing capability with no extractor is unsupported/blocked, not absent.
Missing native symbols or an empty search result never establish zero impact.

Maintain human-reviewed architecture/process notes, durable decisions and a
handover alongside generated graphs. Include source locations, exact graph IDs,
revision/fingerprint and actual validation results. Record why decisions were
made, what failed and what remains open so future sessions avoid repeated work.

## Every coding session

1. Follow the project entry gate and run its documented graph session/freshness
   check before relying on graph results. Read the latest handover and decisions.
2. Query the relevant concepts, then inspect exact symbol IDs or full-path
   context and the current source. Continue pagination when a full read is needed.
3. Before changing an existing function, class or method, run upstream impact.
   Report affected callers/processes and the risk; flag HIGH/CRITICAL findings
   before editing. For new symbols, inspect neighboring entry points first.
4. Treat semantic similarity only as a discovery aid. Confirm dependencies,
   behavior and permissions against structural evidence and source.
5. If an indexer excludes a file or cannot resolve a dynamic relationship,
   inspect its imports/call sites manually and record the limitation.
6. Use rename previews and verify references independently. Do not apply blind
   global substitutions based on common symbol names.

## After changes and before handoff

- Run exact-path change detection and review the actual Git diff.
- Update decisions and reviewed architecture/process notes when behavior changes.
- Refresh graphs after relevant source/docs changes. Reuse unchanged embeddings,
  remove deleted chunks and exclude generated graphs from their own inputs.
- Run focused application tests and the applicable graph checks.
- Stage intended source, documentation and regenerated artifacts together.
  Verify the Git index, not only the working tree, before committing.
- Record the source fingerprint, inspected IDs, impact result, exact commit/PR,
  test outcomes, failures, skips and remaining work in the PR/handover.
- Once evidence is sufficient, stop optional repeated checks. Do not regenerate
  unchanged graphs or re-encode the same data merely to show activity.

## Enforcement and recovery

Install supported session hooks and merge graph checks into existing pre-commit
and CI workflows. Configure required merge checks through the repository's
authorized process. A workflow file alone does not make a check required.

Checks must reject stale source, missing artifacts, digest mismatches, mismatched
staged files and interrupted publication. Use a single writer, validate inputs
before/after extraction and publish the catalog only after complete artifacts.

A watcher is optional during editing; it must have bounded retries and clear
failure reporting. Verify a writer has exited before clearing its lock.

Hooks and CI can verify artifact freshness and recorded tool use. They cannot
prove an arbitrary agent understood the graph or guarantee every external agent
followed this policy. Require revision-specific evidence in the handoff.

## Privacy and isolation

Keep source/query embeddings local. Do not upload private code to external
embedding APIs or shared-brain services. Exclude secrets, credentials, customer
records, provider payloads, dependency trees, builds, local databases and model
caches from committed memory. Developer memory does not import application
runtime/customer memory. Report access blockers rather than bypassing them.

## Installation acceptance

Before marking setup complete, demonstrate on the target repository:

1. A fresh session can discover the actual catalog and reading map.
2. Known source symbols return correct context and upstream impact.
3. Every applicable graph has source-backed content, declared limits, valid
   endpoints and complete pagination; none contains copied MAH project data.
4. A real local embedding and retrieval operation runs using verified model
   assets; placeholders or zero embedding operations do not count.
5. A source edit is detected as stale; refresh repairs it; deleting source also
   removes its semantic chunks.
6. Partial staging and interrupted refresh cannot yield a valid certificate.
7. Existing project hooks/checks continue to run and the new checks fail when
   their required evidence is missing.
8. Two repositories/worktrees keep their indexes and query results isolated.
9. The supported platforms, actual commands, outcomes and remaining gaps are
   recorded. Application integration tests remain a separate validation scope.

Until these checks run, report template/preparation status separately from
installation and application acceptance.
