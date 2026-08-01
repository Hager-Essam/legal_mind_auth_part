# Documentation contribution and validation

Treat source code and operator scripts as the authority. Do not infer live
deployment state from source or a historical report.

For every change:

1. identify the canonical owner document from `docs/README.md`;
2. compare routes with router mounts/controllers/Zod schemas;
3. compare fields and indexes with Mongoose schemas, raw scripts, and Atlas
   definitions;
4. label behavior implemented-active, implemented-unused, planned, or
   historical;
5. use evidence relevance terminology and official titles correctly;
6. include dates/evidence for runtime counts, readiness, latency, supported-law
   coverage, or model performance;
7. run link/path and secret scans plus TypeScript/tests proportionate to change.

Relative links must resolve. Backticked source paths must match exact repository
case. Mermaid diagrams must reflect call order and should be rendered by a
Markdown/Mermaid preview when edited.

Secret scans must cover Markdown, Postman assets, environment examples, URLs,
and command snippets. Use placeholders only. If a credential is found, remove
it from the working tree, rotate it, audit use, and address history/backups.

Prohibited claims include “production ready,” “no known issues,” and score-based
legal confidence without dated, scoped evidence. Conversation context is not
legal authority; status-registry evidence is not chunk-text verification.
