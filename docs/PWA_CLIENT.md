# PWA and Client Foundation

## Scope

RPL-025 makes the existing web application installable as a privacy-safe PWA and introduces a shared browser client for the v1 workspace API.

This phase does **not** add native-app bearer tokens or OAuth access tokens. The web and installed PWA continue to use the existing Neon Auth cookie session.

## Authentication transport

`GET /api/v1/me/session` exposes the client capability boundary:

```json
{
  "schemaVersion": 1,
  "authTransport": "cookie-session",
  "authenticated": false,
  "user": null
}
```

When authenticated, `user` contains the current session user id, name, and email.

The endpoint is private/no-store. It is an introspection endpoint, not a token-issuing endpoint.

## Browser API client

`lib/workspace-client.ts` owns browser calls to the v1 workspace API.

Rules:

- all calls use `credentials: "include"`
- all calls use `cache: "no-store"`
- structured v1 errors become `WorkspaceApiError`
- UI components should call client functions instead of constructing API URLs themselves
- successful mutations can resync from `GET /api/v1/me/workspace`

## PWA installation

The manifest defines:

- standalone display
- portrait-primary orientation
- app scope and start URL
- 192x192 and 512x512 install icons
- Apple touch icon metadata

The root layout registers `/sw.js` as progressive enhancement. Application usage does not depend on service worker support.

## Offline privacy boundary

The service worker intentionally does **not** persist private user data.

It ignores:

- non-GET requests
- `/api/*`
- `/auth/*`
- `/my` and `/my/*`

No workspace snapshot, settlement data, task data, favorite data, authentication page, or mutation response is written into Cache Storage.

For public document navigation, the worker uses network-first behavior. If the network is unavailable, it returns the cached public `/offline` page.

## Deferred native-app authentication

A standalone iOS/Android client will need a different authentication transport than browser cookies, such as an app-appropriate OAuth/Bearer token flow.

That is deliberately deferred. RPL-025 establishes payload/client boundaries without pretending a browser cookie session is a native mobile authentication design.
