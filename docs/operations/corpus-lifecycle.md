# Corpus lifecycle

The implemented operational sequence is:

1. retain an official/approved source artifact and provenance;
2. run the applicable official or legacy import/classification script in
   dry-run mode;
3. review authority identity, normalized/official titles, text status,
   retrievability, publication status, hashes, and release ID;
4. apply the import/publication with accountable approval;
5. apply verified authority-status changes where registry evidence exists;
6. re-embed changed content using the configured model/dimension;
7. create/verify Mongo and Atlas indexes;
8. run `audit:legal-corpus` and preserve a dated report.

Implemented commands cover official 2025 labor law, updated social-insurance and
procurement laws, legacy classification/publication, status migration,
re-embedding, and audit. Their accepted flags and artifacts are script-specific;
inspect help/source before operating.

Official-source and approved-legacy publication are not equivalent evidence.
`authorityStatus` verification does not validate chunk text. Extraction is not
verbatim certification. Release IDs are metadata, not records in a release
collection.

Never publish solely because a script parsed successfully. Human editorial
authority and incident/rollback ownership must be established operationally.
