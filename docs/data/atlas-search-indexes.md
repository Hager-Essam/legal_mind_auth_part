# Atlas search indexes

Atlas indexes are not created during API startup. Run the explicit operator
command described in [migrations and indexes](../operations/migrations-and-indexes.md).

`legal_chunks_vector` is a `vectorSearch` index with cosine vector field
`embedding`, dimension `LEGALMIND_EMBEDDING_DIM`, and filters:
`is_retrievable`, `jurisdiction`, `reviewStatus`, `authorityStatus`,
`authorityType`, `law_category`, `law_number`, `law_year`, `appeal_number`, and
`judicial_year`.

`legal_chunks_text` is a static `search` index. Arabic-analyzed string fields
are `text`, `authorityTitleOfficial`, `authorityTitleNormalized`,
`law_name_normalized`, and `case_subject`. `article_number` is a string mapping;
retrievability is boolean; jurisdiction/governance/type/category/law/appeal
identifiers are token mappings.

`npm run atlas:indexes` is dry-run unless script utilities recognize `--apply`.
It lists existing indexes, compares canonical definitions, creates/updates when
permitted, and reports ready/pending state. An incompatible existing type causes
failure and requires manual recreation. Permissions, unsupported Mongo
commands, build errors, and readiness failures also require Atlas operator work.

Repository definitions do not establish live readiness. Record a date and
deployment identifier whenever reporting actual index state.
