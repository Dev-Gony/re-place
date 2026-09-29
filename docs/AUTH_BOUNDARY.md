# Re:Place Authentication & Ownership Boundary

Updated: 2026-09-29

## Identity

Re:Place uses Neon Auth (Managed Better Auth).

Every private row added in RPL-013 and later must be owned by the authenticated Neon Auth user ID.

Canonical owner column:

```sql
auth_user_id text not null
```

Do not accept an owner ID from URL params, request JSON, query strings, or form input.

The owner ID must come from the validated server session only.

## Server access rule

Private route/query sequence:

1. Read the server session with `auth.getSession()`.
2. Reject when `session.user` is missing.
3. Bind `session.user.id` as the first ownership parameter.
4. Scope every SELECT/UPDATE/DELETE to that owner.
5. Return 404 for resources that do not belong to the session user instead of revealing another user's existence.

Example query shape:

```sql
select *
from user_campaign_records
where auth_user_id = $1
  and id = $2
```

`$1` must always be the authenticated session user ID.

## Cache boundary

Public campaign discovery may use the existing campaign cache.

Private/user-specific data must never be placed in `lib/campaign-cache.ts` or any process-global cache keyed without user identity.

Private HTTP responses use:

```
Cache-Control: private, no-store
```

## Environment boundary

- Production Auth belongs to the production Neon branch.
- Preview Auth belongs to the preview Neon branch.
- CI Auth belongs to the CI Neon branch.
- Cookie secrets must be different per environment.
- Never reuse production auth URLs or cookie secrets in Preview/CI.

## OAuth

Initial integration supports the Neon Auth built-in email flow.

Google can be added after Google OAuth credentials are configured per environment.

Naver is not exposed by the current Neon Auth provider management API and is deferred rather than implemented through a fragile custom bypass.


## Current Neon Auth endpoints

Production:
- `NEON_AUTH_BASE_URL=https://ep-morning-rain-b5o8puxr.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth`
- trusted origin: `https://re-place.devgony.com`

Preview:
- `NEON_AUTH_BASE_URL=https://ep-long-dream-b5wthfmt.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth`
- localhost is currently trusted
- add the exact Vercel Preview origin after the next Preview deployment URL is available

CI:
- Managed Better Auth is provisioned on the CI branch.
- CI builds use non-secret placeholder auth values and do not perform live sign-in.

## Vercel runtime wiring

Before the auth PR can be deployed, Vercel needs two server-only variables in each runtime environment:

- `NEON_AUTH_BASE_URL`
- `NEON_AUTH_COOKIE_SECRET`

`NEON_AUTH_COOKIE_SECRET` must be a unique random value of at least 32 characters per environment. Do not reuse Production in Preview.

The cookie secret is intentionally not stored in GitHub, docs, or chat.
