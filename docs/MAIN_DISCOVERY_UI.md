# Main discovery UI direction

RPL-032에서 사용자가 제공한 Stitch 시안을 제품 메인 탐색 화면의 기준으로 채택한다.

## Visual direction

- warm stone canvas: #FAF9F6
- white data surfaces
- forest green primary: #1B3B30
- hairline border: #E6E5E1
- compact 4px-based spacing
- small 4~8px radius
- no oversized marketing hero
- no thumbnail-first campaign cards
- no decorative gradients in the campaign discovery workspace

## Desktop structure

1. 56px sticky top navigation
2. compact product heading + freshness metadata
3. 44px search field
4. quick filters + compact URL-driven filters
5. dense campaign comparison list
6. persistent right campaign inspector

The inspector only renders fields grounded in current campaign data. Do not invent selection dates, visit windows, review deadlines, guide keywords, notification counts, subscription plan labels, or profile names from design mock data.

## Mobile structure

- existing global bottom navigation remains the primary app nav
- campaign rows stack into compact cards
- selected campaign inspector opens as a bottom sheet above the global bottom navigation
- no horizontal page overflow
- sheet must be dismissible without navigating away

## Interaction principles

- search shortcut: / or Cmd+K outside form fields
- filter mutations remain URL-driven
- row click changes detail inspector
- original campaign source always remains directly accessible
- favorites reuse authenticated workspace behavior

## Data honesty

Mockup content is visual reference only. Production UI must never present fabricated campaign schedule, guide, address, engagement, notification, profile, or plan data.
