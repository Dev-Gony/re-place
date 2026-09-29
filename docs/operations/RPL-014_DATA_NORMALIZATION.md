# RPL-014 Platform Data Normalization

Updated: 2026-09-29

Re:Place does not assume that every source exposes the same campaign fields.
The UI uses one normalized schema, but each collector is responsible for mapping
its own source semantics into that schema.

## Normalized fields

- `title`: campaign/store/product title only
- `platform`: source service
- `media_type`: blog / Instagram / reels / YouTube / short-form
- `campaign_type`: visit / delivery / pickup / payback / reporter
- `reward`: raw source benefit text
- `apply_count`, `recruit_count`: null when the source does not expose the value
- `region`: source-provided or source-card location, not a guess from brand name
- `region_group`: broad group derived from normalized region
- `deadline_at`: source deadline converted to an absolute timestamp

## Mible

Observed public list cards expose location separately from the `.subject` title.
Examples on the public list include location prefixes such as:

- 광주 수완동
- 홍대입구역
- 포천
- 천안 백석동

Previous behavior read only `.subject`, so location was discarded and many
Mible rows became `region = null`.

RPL-014 behavior:

- use the text before the title as the location hint
- only accept that hint when it maps to a known region group
- treat delivery labels as delivery rather than a physical region
- treat D-Day as today's deadline
- keep unknown locations null rather than inventing one

## DinnerQueen

The list title generally contains a bracketed region, for example
`[서울 강남][릴스] ...`.

RPL-014 keeps the existing strategy:

- bracket region from title
- apply/recruit count from list card
- reward and exact deadline from detail page
- media/type from source labels

## ReviewPlace

The region category encodes important meaning in a leading tag, for example:

- `[서울/서초/7만원상당]`
- `[릴스/경기/시흥]`
- `[경남/거제]`

Previous behavior set `campaign_type = 방문형` for the region category but
discarded the actual region.

RPL-014 behavior:

- strip listing flags such as `NEW`
- parse media labels separately
- extract geographic tokens from the leading tag
- product campaigns map to delivery / region-free
- purchase-review campaigns map to payback / region-free
- reporter campaigns map to reporter, with nationwide fallback when no location is supplied

## ReviewUs

The public list exposes:

- campaign type
- media
- application/recruit counts
- D-Day

Delivery campaigns explicitly normalize to `region = 배송`.

For visit campaigns, the list does not reliably expose a physical address.
Re:Place therefore displays `위치 원문 확인` instead of fabricating a region.

## Gangnam-review

Gangnam-review remains paused.

The verified public JSON endpoint exposes only a fixed recommendation sample,
not the full catalogue. Legacy rows in the database are not considered active
search data because the source registry disables search for this source.

The UI shows paused sources as integration status rather than pretending they
are available filters.

## UI display rules

The list prioritizes:

1. campaign title + platform/type/media
2. benefit
3. applicants / 모집 / 경쟁률
4. deadline + normalized location
5. favorite / original link

Unknown values are described explicitly:

- missing physical region: `위치 원문 확인`
- delivery/payback region: `지역무관`
- unknown deadline: `마감 미정`

No source-specific missing field is rendered as a fake zero or fake location.
