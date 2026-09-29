# RPL-011 Major Source Findings

Updated: 2026-09-29

## Scope

RPL-011 now focuses on:

- Gangnam-review / 강남맛집
- Revu / 레뷰
- Supermembers / 슈퍼멤버스

ReviewNote remains blocked by source policy and is intentionally excluded from technical reactivation work.

## Gangnam-review

### Existing collector problems

The legacy collector:

- used the former punycode domain
- fetched one landing HTML page only
- depended on legacy CSS classes such as `li.list_item`
- stored the entire `/cp/?id=...` path as source_campaign_id
- did not collect deadline information
- silently became stale after a single collection on 2026-09-19

Production currently contains 75 Gangnam-review legacy rows, all collected at the same old timestamp and all without deadline_at.

### Current public structure verified

Cloud smoke checks confirmed:

- `https://gangnam-review.net/cp/?id=...` detail pages return HTTP 200
- the site exposes `/index_recommend.php` as public JSON
- that endpoint exposes fields including:
  - href
  - subject
  - content
  - type
  - channel
  - cmp_num
  - cmp_ask_num
  - d_gap
  - point
- the recommendation endpoint returns exactly 10 recommendation items
- repeated immediate requests returned the same 10 IDs
- the public detail page did not expose a separate catalogue navigation route
- the current root redirects toward the legacy host, which timed out from GitHub-hosted runners

### Decision

The old full-page HTML crawler is retired.

The new Gangnam parser uses the verified public JSON contract for a lightweight probe and fixture regression, but production DB writes remain intentionally blocked because the verified endpoint is not a complete catalogue.

This prevents partial recommendation data from being presented as complete Gangnam-review coverage.

### Reactivation gate

Gangnam-review can become `active` only after one of these is verified:

1. a stable public full-list endpoint
2. a documented official API/partner feed
3. another complete public catalogue route that is reachable from the production collector environment

Until then, source registry stays paused.

## Revu

Existing code depends on `REVU_BEARER_TOKEN`.

RPL-011 will not use copied browser tokens, session extraction, or other authentication bypass as a production collection strategy. A public or official route must be verified.

## Supermembers

The blogger-facing experience is app-centric. Investigation will focus on official/public web, API, or partner routes. App session interception is not a default production strategy.
