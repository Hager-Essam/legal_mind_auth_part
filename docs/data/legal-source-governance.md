# Legal-source governance

Governance metadata is stored on each `legal_chunks` document. The static
authority-status registry supplies curated identity/status evidence for
migrations and audits; it can verify status without verifying stored chunk text
or proving publication eligibility by itself.

Runtime retrieval fails closed on jurisdiction, retrievability, publication,
and authority eligibility. Published `effective`, `amended`, and `unknown`
authorities are eligible; published historical court rulings are eligible;
historical statutes and repealed authorities are not.

Official imports and owner-approved legacy publication use different evidence:
official artifacts carry official-source/provenance checks, while legacy
publication records its own verification method and approval basis. “Published”
therefore does not imply identical provenance or verbatim certification.

Corpus scripts validate and normalize artifacts, upsert draft/review metadata,
publish through an explicit apply path, classify legacy authorities, apply
verified statuses, re-embed, and audit. Review counts named “candidates” do not
necessarily equal modified records.

Release IDs are fields on chunks and snapshots; there is no release collection.
Likewise there is no authority master collection. Governance changes have a
dedicated collection only for the status migration.

Publication/status changes require an accountable human editorial owner. The
repository does not identify that person or role; operators must define it
outside code and retain evidence.
