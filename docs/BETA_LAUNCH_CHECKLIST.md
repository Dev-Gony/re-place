# Re:Place Beta Launch Checklist

Updated: 2026-09-29

## Launch target

Public beta for campaign discovery only.

Production URL: https://re-place.devgony.com

## Ready

- [x] Production web deploys from main.
- [x] Production / Preview / CI database boundaries are separated.
- [x] Public DB health response is minimized.
- [x] Active source registry controls collection and search visibility.
- [x] Stale and known-expired campaigns are hidden from default search.
- [x] Reward values are separated into cash fee / provided value / points / reimbursement.
- [x] Korean timezone, unknown counts, and region normalization are covered by regression tests.
- [x] Search/filter UI is responsive and thumbnail-free.
- [x] Mobile horizontal overflow has a regression guard.
- [x] Source-usage policy register exists.
- [x] robots.txt and sitemap.xml exist.
- [x] Canonical and Open Graph metadata target the production domain.
- [x] 404 and runtime error recovery screens exist.
- [x] Basic response security headers are configured.
- [x] Common CI validates lint, Node tests, Next build, Python tests, and crawler compilation.
- [x] Campaign collection runs every six hours for enabled sources.

## Beta limitations

- Login, favorites, personal campaign records, and notifications are not part of this beta.
- Source campaign availability can change between six-hour collection windows.
- Some source fields can be unknown when the original platform does not expose them.
- Automatic visual browser verification is currently limited by the connected Vercel team permission; production deployment status is still verified by GitHub/Vercel status checks.

## Release gate

A beta release is considered healthy when:

1. main CI is green.
2. Vercel Production reports deployment success.
3. the most recent scheduled/manual campaign collection succeeds.
4. Neon production contains at least one visible campaign from each enabled source unless that source legitimately has no open campaign.
5. no blocked/paused source appears in default search.
