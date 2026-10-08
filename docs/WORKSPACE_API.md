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

## Mutation API

RPL-024 adds versioned workspace mutation endpoints.

### Favorites
- `POST /api/v1/me/favorites`
- `DELETE /api/v1/me/favorites/:campaignId`

### Records
- `POST /api/v1/me/records`
- `PATCH /api/v1/me/records/:id`
- `DELETE /api/v1/me/records/:id`

Record creation returns both `data.item` and `data.settlement`. The settlement object is the complete read model for the created record, including any existing user-entered settlement values and the separate campaign source amounts. Clients can reconcile both collections from this response without a follow-up workspace read.

### Tasks
- `POST /api/v1/me/tasks`
- `PATCH /api/v1/me/tasks/:id`
- `DELETE /api/v1/me/tasks/:id`

Task creation is idempotent for the same owner, record, task type, normalized title, and due timestamp. A new task returns HTTP 201 with `created: true`; an exact duplicate returns the existing task with HTTP 200 and `created: false`. The record row is locked during the check and insert so concurrent submissions for one record are serialized.

Task PATCH accepts any non-empty combination of `taskType`, `title`, `dueAt`, and `completed`. Editable fields are validated and kept owner-scoped. An edit that would duplicate another task returns HTTP 409 with `CONFLICT`.

### Settlements
- `PUT /api/v1/me/settlements/:recordId`

Successful mutations use this envelope:

```json
{
  "schemaVersion": 1,
  "mutatedAt": "2026-09-30T00:00:00.000Z",
  "data": {}
}
```

Mutation errors use the same structured error shape as workspace reads:

```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "..."
  }
}
```

Supported v1 error codes are `UNAUTHORIZED`, `INVALID_INPUT`, `NOT_FOUND`, and `CONFLICT`. Task updates use `CONFLICT` when an identical schedule already exists.

The owner ID always comes from the authenticated server session. Client-provided `auth_user_id` or `userId` values are not trusted.

The existing `/api/private/*` write endpoints remain available as backward-compatible routes during this migration phase. The web workspace uses typed v1 mutation responses for local reconciliation. `GET /api/v1/me/workspace` remains the initial-load and explicit full-resync contract.

## Future mobile step

A standalone mobile client should add an app-appropriate authentication mechanism in a later version without changing the workspace payload shape. The v1 payload is intentionally independent from React or Next.js UI components.
