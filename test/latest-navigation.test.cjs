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

test("filter panel waits for the active transition before starting the queued URL", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "app", "filter-controls.tsx"),
    "utf8",
  );

  assert.match(source, /new LatestNavigationCoordinator\(\)/);
  assert.match(source, /pendingObservedRef\.current = true/);
  assert.match(source, /navigationRef\.current\.settle\(\)/);
  assert.match(source, /navigationRef\.current\.request\(href\)/);
});
