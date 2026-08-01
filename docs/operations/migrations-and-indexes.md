# Migrations and indexes

Back up the target databases and record collection counts/index definitions
before mutation. Scripts are not transactional and do not implement automatic
rollback.

Recommended order for an existing deployment:

1. inspect/dry-run auth, chat, and legal metadata migrations;
2. run with `--apply` only after reviewing candidate output;
3. run `npm run indexes:app`;
4. run `npm run create-indexes` for legal RAG B-tree indexes;
5. run `npm run atlas:indexes` first as dry-run, then with `-- --apply`;
6. verify `$listSearchIndexes` readiness and representative exact/vector/text
   queries;
7. run corpus audit.

Relevant commands are `migrate:auth`, `migrate:chat`,
`migrate:legal-source-metadata`, `migrate:verified-authority-statuses`,
`indexes:app`, `create-indexes`, and `atlas:indexes`.

Dry-run summaries count candidates; do not report those as modified records.
If an Atlas index has the wrong type, the setup script refuses to replace it:
review and recreate manually. Retain pre-change definitions and a documented
manual rollback procedure.

The `migrate`, `diagnose`, and `view-db` aliases are broken because their source
files are absent.
