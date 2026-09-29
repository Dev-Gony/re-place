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

### Verified

- Public web shell at `webview.revu.net` returns HTTP 200 without login.
- The existing collector targets `api.weble.net/v1/campaigns`.
- The campaign endpoint returns HTTP 401 without authentication.
- Current Revu web/search surfaces expose campaign discovery to users, but the verified structured campaign API remains authenticated.
- Current public terms and operating policy were reviewed. No explicit public API reuse permission was identified.

### Decision

The existing `REVU_BEARER_TOKEN` collector remains out of production.

Re:Place will not use:

- copied browser tokens
- app tokens
- session extraction
- automated account login for token harvesting

Reactivation requires a public catalogue path, official API, or partner feed that can be used without borrowing a member session.

## Supermembers

### Product-model finding

Supermembers is not a normal apply-and-select campaign board.

The blogger app exposes immediately usable partner stores/products based on membership eligibility. This means a future Re:Place integration should model Supermembers as an available **opportunity/store benefit**, not pretend every row is a normal recruitment campaign.

### Verified technical structure

- Public business website returns HTTP 200.
- The Nuxt frontend publicly references `api.supermembers.co.kr` and `console-api.supermembers.co.kr`.
- Public frontend code contains company/store management GET routes.
- Direct unauthenticated requests to the tested read routes returned HTTP 403.
- The blogger-facing store list therefore cannot currently be treated as a public catalogue API.
- Google Play identifies the blogger app package as `kr.co.mayacrew.supermembers`.

### Decision

Do not intercept app sessions or reuse member credentials.

Supermembers remains paused until one of these exists:

1. official/partner data feed
2. documented API
3. public, unauthenticated catalogue route intentionally exposed for store/opportunity discovery

If integrated later, use a dedicated opportunity/store-benefit model rather than forcing the data into a recruitment-only campaign schema.

## RPL-011 conclusion

No major source is being falsely marked active.

- ReviewNote: blocked by policy
- Gangnam-review: technically paused because complete catalogue entry point is not verified
- Revu: paused because structured campaign API requires authentication
- Supermembers: paused because blogger catalogue is membership/app gated

The current production collectors stay unchanged. This keeps coverage claims honest while preserving verified parsers/probes and reactivation gates.
