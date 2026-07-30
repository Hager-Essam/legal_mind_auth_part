# LegalMind Graduation Demo

## Preparation

1. Configure `backend-ts/.env` and `frontend/.env`.
2. Run the application migrations and indexes described in
   `MONGO_ATLAS_SETUP.md`; wait for both Atlas Search indexes to be ready.
3. Use a reviewed, published Egyptian-law corpus release.
4. Start the backend with `npm run dev` and the frontend with `npm run dev`.
5. Prepare two verified demo accounts. Do not bypass verification in a
   production-like deployment.

## Repeatable demonstration

1. Register a lawyer and show that the role is assigned by the server.
2. Verify the email in development console mode, or log in with an approved
   verified demo account.
3. Log in and point out that only the access token is held by the frontend; the
   refresh token is an HTTP-only cookie.
4. Create a conversation named `فصل العامل`.
5. Ask `ما شروط فصل العامل في القانون المصري؟`.
6. Open the sources panel and show official titles, article numbers, authority
   status, excerpts, and official links where present.
7. Ask `وماذا عن فترة الاختبار؟` and show that the stored retrieval query
   resolves the employment/probation context.
8. Refresh the browser, reopen the conversation, and show restored messages
   and saved source snapshots.
9. Rename the conversation, archive it, and use the archived filter.
10. Log out, log in as the second account, and attempt the first conversation's
    URL/API identifier. Show the 404 ownership response and absence from the
    list.
11. Ask `مرحبا، ما عقوبة التزوير؟` and show that greeting text does not bypass
    legal retrieval.
12. Compare an old saved source snapshot with a changed corpus record to show
    that historical conversation evidence remains unchanged.
13. Demonstrate contract analysis only after its routes are present, protected,
    and its original regression suite passes. The supplied LegalMind repository
    did not contain that implementation, so this is currently a documented
    follow-up rather than a fabricated demo step.

## Legal notice

Keep this notice visible:

> LegalMind is an academic legal-research assistant. Verify important
> conclusions against official and current legal sources before relying on
> them.

Never describe an evidence relevance score as legal accuracy.

