# Workspace API v1

## Purpose

`GET /api/v1/me/workspace` returns the authenticated user's personal Re:Place workspace as one consistent client snapshot.

The endpoint exists so the web workspace and future clients do not need to independently assemble favorites, participation records, tasks, and settlement data.

## Authentication

v1 currently uses the same server session as the web app.

- The owner ID is derived from the authenticated session.
- The client cannot submit or override `auth_user_id`.
- Unauthenticated requests return HTTP 401.

Bearer-token / OAuth authentication for a standalone mobile app is intentionally out of scope for RPL-023.

## Success response

```json
{
  "schemaVersion": 1,
  "syncedAt": "2026-09-30T00:00:00.000Z",
  "favorites": [],
  "records": [],
  "tasks": [],
  "settlements": []
}
```

### Contract rules

- `schemaVersion` changes only when a breaking response-contract change is introduced.
- `syncedAt` is generated after the workspace queries complete.
- All four collections belong to the same authenticated owner.
- Completed/cancelled record ordering and task ordering follow the web workspace rules.
- Settlement reward meanings remain separate. Cash, provided value, points, and reimbursement are not collapsed into one amount.

## Error response

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

Clients should branch on `error.code`, not on the human-readable message.

## Mutation compatibility

RPL-023 does not replace existing write endpoints.

- `/api/private/favorites`
- `/api/private/records`
- `/api/private/records/:id`
- `/api/private/tasks`
- `/api/private/tasks/:id`
- `/api/private/settlements`

After a successful mutation, the web client refreshes from `/api/v1/me/workspace` so all workspace collections move to the same snapshot together.

## Future mobile step

A standalone mobile client should add an app-appropriate authentication mechanism in a later version without changing the workspace payload shape. The v1 payload is intentionally independent from React or Next.js UI components.
