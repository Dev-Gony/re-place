# Environment isolation

Re:Place keeps production, preview, and CI database access separate.

| Runtime | Database | Credential source |
| --- | --- | --- |
| Vercel Production | Neon `production` branch | Vercel Production `DATABASE_URL` |
| Vercel Preview | Neon `preview` branch | Vercel Preview `DATABASE_URL` |
| Pull request CI | none by default | no database credential |
| Optional DB integration CI | Neon `ci` branch | GitHub `CI_DATABASE_URL` only |
| Scheduled/manual collectors | Neon `production` branch | GitHub Environment `production` secret `PRODUCTION_DATABASE_URL` |
| Production DB smoke | Neon `production` branch | GitHub Environment `production` secret `PRODUCTION_DATABASE_URL` |

## Neon branches

RPL-003 provisions two children of the production branch:

- `preview`: Vercel Preview deployments.
- `ci`: isolated database integration tests when a future test genuinely needs a live Postgres connection.

Both use the minimum compute size and suspend when idle. They are snapshots, not synchronization targets. Production collector writes do not automatically flow into them after branch creation.

## Required one-time secret wiring

Secrets are never committed to this repository.

### GitHub

Create or use the GitHub Environment named `production`. Add:

- `PRODUCTION_DATABASE_URL`: pooled connection string for the Neon `production` branch.

Do not expose this secret to pull-request jobs.

If a future database integration workflow is added, create `CI_DATABASE_URL` from the Neon `ci` branch and scope it only to that job. Do not rename it to the generic `DATABASE_URL` at repository-secret level.

### Vercel

Keep the variable name `DATABASE_URL` because the application expects it, but scope the values by Vercel environment:

- Production: Neon `production` branch connection string.
- Preview: Neon `preview` branch connection string.
- Development: local developer branch or a local-only value, never production by default.

After changing Preview scope, create a new Preview deployment. Existing deployments keep the environment snapshot they were built with.

## Rules

1. PR validation must pass without database credentials.
2. Scheduled collectors are production jobs and may not run on pull requests.
3. Production smoke checks are manual and use `SELECT 1`, not application data counts.
4. Never print connection strings, passwords, or secret values in CI output.
5. Database schema changes are tested on a child branch before production.
