# Secrets and private files

Keep JWT secrets, MongoDB URIs, DashScope keys, SMTP passwords, refresh/access
tokens, reset/verification tokens, and lawyer credentials out of Git, Markdown,
logs, screenshots, Postman exports, and support messages. Use environment
injection and placeholders such as `<mongodb-uri>` and `<api-key>`.

The old `updated docs/DEPLOYMENT_GUIDE.md` contained credential-like connection
material. It has been removed from canonical documentation. Treat the value as
exposed: rotate it at the provider, invalidate related credentials/sessions,
review access logs, scrub reachable history/artifacts, and document the incident.
Deleting the working-tree copy alone does not remove Git history or backups.

Lawyer credentials are randomized local PDF/JPEG/PNG files. Current validation
checks filename/extension and MIME, not magic bytes. Files should live outside a
public web root with least-privilege OS access, encryption/backup policy, malware
scanning, review authorization, retention/deletion workflow, and audit trail.
Those lifecycle controls are not implemented by this backend.

Console email logs verification/reset URLs outside production. Do not use
console mode in any deployed environment even though configuration technically
allows it.
