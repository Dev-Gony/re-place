const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { LatestNavigationCoordinator } = require("../lib/latest-navigation.js");

test("serializes navigation and retains only the latest queued filter URL", () => {
  const coordinator = new LatestNavigationCoordinator();

  assert.equal(coordinator.request("/?platform=revu"), "/?platform=revu");
  assert.equal(coordinator.request("/?platform=revu&platform=reviewnote"), null);
  assert.equal(coordinator.request("/?platform=reviewnote"), null);

  assert.equal(coordinator.activeHref, "/?platform=revu");
  assert.equal(coordinator.queuedHref, "/?platform=reviewnote");
  assert.equal(coordinator.settle(), "/?platform=reviewnote");
  assert.equal(coordinator.activeHref, "/?platform=reviewnote");
  assert.equal(coordinator.queuedHref, null);
  assert.equal(coordinator.settle(), null);
});

test("does not repeat a completed URL when the latest request is identical", () => {
  const coordinator = new LatestNavigationCoordinator();

  assert.equal(coordinator.request("/?reward=50000"), "/?reward=50000");
  assert.equal(coordinator.request("/?reward=50000"), null);
  assert.equal(coordinator.settle(), null);
  assert.equal(coordinator.activeHref, null);
});

test("waits for matching server values and survives a filter component remount", () => {
  const coordinator = new LatestNavigationCoordinator();

  assert.equal(coordinator.request("/?platform=revu"), "/?platform=revu");
  assert.equal(coordinator.request("/?platform=reviewnote&platform=revu"), null);
  assert.equal(coordinator.settleCommitted("/"), null);
  assert.equal(coordinator.activeHref, "/?platform=revu");

  assert.equal(
    coordinator.settleCommitted("/?platform=revu"),
    "/?platform=reviewnote&platform=revu",
  );
  assert.equal(coordinator.activeHref, "/?platform=reviewnote&platform=revu");
  assert.equal(
    coordinator.settleCommitted("/?platform=reviewnote&platform=revu"),
    null,
  );
  assert.equal(coordinator.activeHref, null);
});

test("filter panel settles against committed server values outside component refs", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "app", "filter-controls.tsx"),
    "utf8",
  );

  assert.match(source, /const filterNavigation = new LatestNavigationCoordinator\(\)/);
  assert.match(source, /const committedHref = filterHrefFromValues\(values\)/);
  assert.match(source, /filterNavigation\.settleCommitted\(committedHref\)/);
  assert.match(source, /window\.location\.replace\(nextHref\)/);
  assert.match(source, /filterNavigation\.request\(href\)/);
  assert.match(source, /const FILTER_CHANGE_DELAY_MS = 400/);
  assert.match(source, /filterTimer\.current = setTimeout\(applyNow, delay\)/);
  assert.doesNotMatch(source, /useRef\(new LatestNavigationCoordinator/);
});
