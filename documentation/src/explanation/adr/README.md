# Architecture Decision Records

This directory contains the Architecture Decision Records (ADRs) for the
auth-service. An ADR captures a significant architectural decision, the
context that led to it, and the consequences of choosing it over the
alternatives.

## Why ADRs?

Code shows *what* was built. Commit history shows *when* and *by whom*.
ADRs explain **why** — the constraints, the alternatives that were rejected,
and the trade-offs that were accepted. They are the antidote to
"we used to know why we did this, but the person who knew has left".

## Conventions

- **One file per decision**, numbered sequentially: `NNNN-kebab-case-title.md`.
- **Immutable once accepted.** To change a decision, create a new ADR that
  supersedes the old one and update the old one's Status field to
  `Superseded by [ADR XXXX](./XXXX-new.md)`.
- **Written in English**, like the rest of the codebase.
- **Follow the [template](./template.md)** — Context, Decision, Consequences,
  Alternatives Considered, References.
- **Added in the same PR as the code change** that implements the decision,
  whenever possible.

## Index

| #    | Title                                                                       | Status   | Date       |
|------|-----------------------------------------------------------------------------|----------|------------|
| 0001 | [Separation of Responsibilities Between auth-service and user-service](./0001-denormalize-user-data.md) | Accepted | 2025-04-11 |
| 0002 | [CORS Origin Whitelist via Environment Variable](./0002-cors-origin-whitelist.md) | Accepted | 2026-04-11 |
| 0003 | [API Versioning via URI Prefix](./0003-api-versioning-uri-prefix.md)        | Accepted | 2026-04-11 |

## Adding a new ADR

1. Copy [`template.md`](./template.md) to `NNNN-short-title.md` where `NNNN`
   is the next available number.
2. Fill in all sections. Delete any that genuinely do not apply, but prefer
   writing "N/A — reason" over silent omission.
3. Add the ADR to the index table above and to
   [`SUMMARY.md`](../../SUMMARY.md) so it is reachable from the mdBook nav.
4. Commit the ADR in the **same PR** as the code change it justifies.
