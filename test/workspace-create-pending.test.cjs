const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const workspace = fs.readFileSync(
  path.join(root, "app/my/my-workspace.tsx"),
  "utf8",
);
const deadlineBoard = fs.readFileSync(
  path.join(root, "app/my/content-deadline-board.tsx"),
  "utf8",
);

test("workspace create handlers block re-entry before sending requests", () => {
  assert.match(workspace, /taskCreateLock = useRef\(false\)/);
  assert.match(workspace, /deadlineCreateLock = useRef\(false\)/);
  assert.match(workspace, /manualCreateLock = useRef\(false\)/);
  assert.match(workspace, /if \(taskCreateLock\.current\) return/);
  assert.match(workspace, /if \(deadlineCreateLock\.current\) return false/);
  assert.match(workspace, /if \(manualCreateLock\.current\) return/);
});

test("workspace create locks are always released after success or failure", () => {
  assert.match(
    workspace,
    /finally \{[\s\S]*?deadlineCreateLock\.current = false;[\s\S]*?setDeadlineCreatePending\(false\)/,
  );
  assert.match(
    workspace,
    /finally \{[\s\S]*?taskCreateLock\.current = false;[\s\S]*?setTaskCreatePending\(false\)/,
  );
  assert.match(
    workspace,
    /finally \{[\s\S]*?manualCreateLock\.current = false;[\s\S]*?setManualCreatePending\(false\)/,
  );
});

test("all three create forms expose pending feedback and disabled submit", () => {
  assert.match(workspace, /aria-busy=\{taskCreatePending\}/);
  assert.match(workspace, /disabled=\{taskCreatePending\}/);
  assert.match(workspace, /taskCreatePending \? "추가 중" : "추가"/);
  assert.match(workspace, /aria-busy=\{manualCreatePending\}/);
  assert.match(workspace, /disabled=\{manualCreatePending\}/);
  assert.match(workspace, /manualCreatePending \? "저장 중" : "등록"/);

  assert.match(deadlineBoard, /if \(createPending\) return/);
  assert.match(deadlineBoard, /aria-busy=\{createPending\}/);
  assert.match(deadlineBoard, /disabled=\{createPending\}/);
  assert.match(
    deadlineBoard,
    /createPending \? "마감 추가 중" : "마감 추가"/,
  );
});

test("forms reset only after the create request succeeds", () => {
  assert.match(
    workspace,
    /await createTaskRequest\([\s\S]*?\);[\s\S]*?form\.reset\(\)/,
  );
  assert.match(
    workspace,
    /await createRecord\([\s\S]*?\);[\s\S]*?form\.reset\(\)/,
  );
  assert.match(
    deadlineBoard,
    /const success = await onCreate\([\s\S]*?if \(success\) \{[\s\S]*?form\.reset\(\)/,
  );
});
