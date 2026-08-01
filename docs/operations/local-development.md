# Local development

Prerequisites are Node.js/npm, reachable App and RAG MongoDB databases, and
DashScope keys for embedding/generation paths. Atlas Search/Vector Search are
required for RAG retrieval. SMTP is optional in local console-email mode.

```powershell
cd backend-ts
npm ci
Copy-Item .env.example .env
npm run typecheck
npm run dev
```

Configure exact frontend origins; the default backend port is 3000. In another
terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Health is `GET http://localhost:3000/health`; readiness is `/ready`. The frontend
base must end in `/api/v1`.

Working backend scripts include `build`, `start`, typecheck/test commands,
`create-indexes`, `indexes:app`, `atlas:indexes`, auth/chat migrations, legal
metadata/status/import/publication/re-embedding/audit commands, and `evaluate`.
Many mutating corpus/migration commands require explicit `--apply`; inspect the
script before running.

Known broken aliases: `migrate`, `diagnose`, and `view-db` reference files not
present in the repository. `serve-ui` is a legacy static helper, not the current
Vite integration.
