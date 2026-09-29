# Re:Place Launch Checklist

Updated: 2026-09-29

## Launch target

Public launch for campaign discovery plus authenticated personal campaign management.

Production URL: https://re-place.devgony.com

## Ready

- [x] Production / Preview / CI database boundaries are separated.
- [x] Public DB health response is minimized.
- [x] Active source registry controls collection and search visibility.
- [x] Stale and known-expired campaigns are hidden from default search.
- [x] Reward values are separated into cash fee / provided value / points / reimbursement.
- [x] Korean timezone, unknown counts, and region normalization are covered by regression tests.
- [x] Search/filter UI is responsive, thumbnail-free, and immediate.
- [x] Mobile horizontal overflow has regression coverage.
- [x] Source-usage policy register exists.
- [x] Neon Auth is enabled for Production / Preview / CI.
- [x] Favorites and personal campaign records are scoped to the authenticated user.
- [x] Private routes and responses are excluded from shared caching/indexing.
- [x] Privacy policy and terms pages exist.
- [x] robots.txt, sitemap.xml, web manifest, canonical metadata, and Open Graph image exist.
- [x] 404, loading, route error, and global error recovery states exist.
- [x] Vercel Analytics and Speed Insights are wired.
- [x] Basic response security headers are configured.
- [x] Common CI validates lint, Node tests, Next build, Python tests, and crawler compilation.
- [x] Campaign collection runs every six hours for enabled sources.

## Source limitations

- ReviewNote is excluded by source policy.
- Revu is paused because the verified structured campaign API requires authentication.
- Gangnam-review is paused because a complete public catalogue endpoint has not been verified.
- Supermembers is paused because the blogger catalogue is membership/app gated.
- Source campaign availability can change between six-hour collection windows.
- Some fields remain unknown when the original platform does not expose them.

## Auth notes

- Production Neon Auth trusted origin includes https://re-place.devgony.com.
- Email/password authentication and Google shared OAuth are present in the current Neon Auth configuration.
- Private user data ownership always comes from the validated server session.
- Preview authentication must use an explicitly trusted Preview origin when visual preview verification is performed.

## Release gate

A release is considered healthy when:

1. main CI is green.
2. Vercel Production deploys the latest main commit successfully.
3. the most recent scheduled/manual campaign collection succeeds.
4. Neon production contains at least one visible campaign from each enabled source unless that source legitimately has no open campaign.
5. no blocked/paused source appears in default search.
6. production sign-in works and /my opens for the authenticated user.
7. favorite → /my add → edit → delete works with one real test account.
8. desktop and mobile smoke checks show no horizontal overflow or unreadable controls.

## Current external blocker

Vercel Hobby build-rate limiting can delay a new Production deployment. Code changes may continue to merge into main while this limit is active. When the limit clears, deploy the newest main commit rather than retrying obsolete intermediate Preview commits.
