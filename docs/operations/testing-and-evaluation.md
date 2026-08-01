# Testing and evaluation

Backend verification commands:

```powershell
npm run typecheck
npm run test:query
npm run test:security
npm run test:auth:unit
npm run test:auth:integration
npm run test:chat
```

Auth/chat integration tests use `mongodb-memory-server` and may need a cached or
downloadable MongoDB binary. Query/security/unit tests mock narrower
dependencies. A passing unit suite does not establish live Atlas/provider/SMTP
behavior.

`npm run evaluate` constructs the full service container, executes
`evaluation_questions.json` against live storage/providers, sends answers to an
LLM judge, and writes a JSON result. Record date, model/config, corpus release,
question-set commit, and environment with any published result. The judge is
not calibrated and its direct call is not a legal-quality guarantee.

Current coverage gaps include full route/E2E behavior, live Atlas definitions
and filters, CORS, upload file signatures, SMTP delivery, migration rollback,
corpus-wide correctness, citation entailment, and contract analysis.
