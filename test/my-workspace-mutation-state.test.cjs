const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.join(__dirname, "..");

function compile(file) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const { outputText, diagnostics } = ts.transpileModule(source, {
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  });
  assert.equal(
    (diagnostics || []).filter(
      (item) => item.category === ts.DiagnosticCategory.Error,
    ).length,
    0,
  );

  const exports = {};
  vm.runInNewContext(outputText, { exports }, { filename: file });
  return exports;
}

const { upsertRecordMutation } = compile("lib/record-mutation-state.ts");
const { upsertTaskMutation } = compile("lib/task-mutation-state.ts");
const { createLatestRequestGate } = compile("lib/latest-request.ts");
const workspace = fs.readFileSync(
  path.join(root, "app/my/my-workspace.tsx"),
  "utf8",
);
const client = fs.readFileSync(
  path.join(root, "lib/workspace-client.ts"),
  "utf8",
);

const record = {
  id: 1,
  campaign_id: null,
  source_type: "manual",
  status: "saved",
  title: "Fixture campaign",
  platform: "Fixture",
  link: null,
  reward: null,
  region: null,
  deadline_at: null,
  note: null,
};

const task = {
  id: 10,
  record_id: 1,
  task_type: "submit",
  title: "Submit",
  due_at: "2026-10-12T00:00:00.000Z",
  completed_at: null,
  record_title: record.title,
  record_platform: record.platform,
};

test("record mutations replace the same id without duplicates", () => {
  const next = upsertRecordMutation(
    [record],
    { ...record, status: "selected", title: "Updated campaign" },
  );

  assert.equal(next.length, 1);
  assert.equal(next[0].status, "selected");
  assert.equal(next[0].title, "Updated campaign");
});
test("late distinct record responses preserve every successful mutation", () => {
  const laterRequest = { ...record, id: 3, title: "Later request" };
  const earlierRequest = { ...record, id: 2, title: "Earlier request" };

  let next = upsertRecordMutation([record], laterRequest);
  next = upsertRecordMutation(next, earlierRequest);

  assert.deepEqual(
    Array.from(next, (item) => item.id),
    [1, 3, 2],
  );
});

test("duplicate task response replaces its row and keeps record context", () => {
  const next = upsertTaskMutation(
    [task],
    { ...task, title: "Existing duplicate returned", completed_at: null },
    { record_title: "Fallback", record_platform: null },
  );

  assert.equal(next.length, 1);
  assert.equal(next[0].title, "Existing duplicate returned");
  assert.equal(next[0].record_title, record.title);
  assert.equal(next[0].record_platform, record.platform);
});

test("late distinct task responses do not erase newer local state", () => {
  const laterRequest = { ...task, id: 12, title: "Later request" };
  const earlierRequest = { ...task, id: 11, title: "Earlier request" };

  let next = upsertTaskMutation([], laterRequest, task);
  next = upsertTaskMutation(next, earlierRequest, task);

  assert.deepEqual(
    Array.from(next, (item) => item.id),
    [12, 11],
  );
});

test("latest request gate rejects an older refresh response", () => {
  const gate = createLatestRequestGate();
  const older = gate.begin();
  const newer = gate.begin();

  assert.equal(gate.isLatest(older), false);
  assert.equal(gate.isLatest(newer), true);
});

test("MyWorkspace consumes typed record and task mutation responses", () => {
  assert.match(client, /MutationEnvelope<\{ item: RecordItem \}>/);
  assert.match(
    client,
    /MutationEnvelope<\{ item: RecordItem; settlement: SettlementItem \}>/,
  );
  assert.match(
    workspace,
    /async function addFavoriteToRecords[\s\S]*?upsertRecordMutation/,
  );
  assert.match(
    workspace,
    /async function createDeadlineTask[\s\S]*?upsertTaskMutation/,
  );
  assert.match(
    workspace,
    /async function createTask[\s\S]*?upsertTaskMutation/,
  );
  assert.match(
    workspace,
    /async function toggleTask[\s\S]*?upsertTaskMutation/,
  );
  assert.match(
    workspace,
    /async function createManual[\s\S]*?upsertRecordMutation/,
  );
  assert.match(
    workspace,
    /async function updateRecord[\s\S]*?upsertRecordMutation/,
  );
});

test("record creation reconciles its settlement without a workspace refresh", () => {
  const favoriteCreate = workspace.slice(
    workspace.indexOf("async function addFavoriteToRecords"),
    workspace.indexOf("async function createDeadlineTask"),
  );
  const manualCreate = workspace.slice(
    workspace.indexOf("async function createManual"),
    workspace.indexOf("async function updateRecord"),
  );

  assert.match(favoriteCreate, /result\.data\.settlement/);
  assert.match(favoriteCreate, /upsertSettlementMutation/);
  assert.match(manualCreate, /result\.data\.settlement/);
  assert.match(manualCreate, /upsertSettlementMutation/);
  assert.doesNotMatch(workspace, /reloadSettlements|getWorkspace\(\)/);
});

test("failed mutations preserve lists and success-only form state", () => {
  const taskCreate = workspace.slice(
    workspace.indexOf("async function createTask"),
    workspace.indexOf("async function toggleTask"),
  );
  const taskCreateCatch = taskCreate.slice(
    taskCreate.indexOf("} catch {"),
    taskCreate.indexOf("} finally {"),
  );
  assert.doesNotMatch(taskCreateCatch, /setTasks|form\.reset/);

  const manualCreate = workspace.slice(
    workspace.indexOf("async function createManual"),
    workspace.indexOf("async function updateRecord"),
  );
  const manualCreateCatch = manualCreate.slice(
    manualCreate.indexOf("} catch {"),
    manualCreate.indexOf("} finally {"),
  );
  assert.doesNotMatch(
    manualCreateCatch,
    /setRecords|form\.reset|setManualOpen/,
  );

  const recordUpdate = workspace.slice(
    workspace.indexOf("async function updateRecord"),
    workspace.indexOf("function requestDelete"),
  );
  const recordUpdateCatch = recordUpdate.slice(recordUpdate.indexOf("} catch {"));
  assert.doesNotMatch(recordUpdateCatch, /setRecords|setSettlements/);
});
