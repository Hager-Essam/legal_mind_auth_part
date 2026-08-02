# Postman documentation

Use [FRONTEND-README.md](./FRONTEND-README.md) as the authoritative frontend
integration guide. It lists all 40 currently registered backend endpoints,
required frontend replacements, unsupported routes, authentication behavior,
profile/avatar/bookmark contracts, and the recommended Postman workflow.

Import:

1. `LegalMind-Frontend-API.postman_collection.json`
2. `LegalMind-Frontend-Local.postman_environment.json` or
   `LegalMind-Frontend-Production.postman_environment.json`

Registration is JSON-only. The dedicated R2 avatar request is the only current
user/auth request that uses multipart form data.
