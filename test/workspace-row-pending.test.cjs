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

const { createPendingActionRegistry } = compile("lib/pending-actions.ts");
const workspace = fs.readFileSync(
  path.join(root, "app/my/my-workspace.tsx"),
  "utf8",
);
const deadlineBoard = fs.readFileSync(
  path.join(root, "app/my/content-deadline-board.tsx"),
  "utf8",
);

test("pending registry blocks one row while leaving other rows independent", () => {
  const registry = createPendingActionRegistry();

  assert.equal(registry.begin(7, "toggle"), true);
  assert.equal(registry.begin(7, "delete"), false);
  assert.equal(registry.get(7), "toggle");
  assert.equal(registry.begin(8, "delete"), true);

  const snapshot = registry.snapshot();
  assert.equal(snapshot.size, 2);
  assert.equal(snapshot.get(8), "delete");

  registry.end(7);
  assert.equal(registry.has(7), false);
  assert.equal(snapshot.has(7), true);
  assert.equal(registry.begin(7, "delete"), true);
});

test("task mutations acquire and always release the row registry", () => {
  assert.match(
    workspace,
    /async function toggleTask[\s\S]*?if \(!beginTaskAction\(task\.id, "toggle"\)\) return;[\s\S]*?finally \{[\s\S]*?endTaskAction\(task\.id\)/,
  );
  assert.match(
    workspace,
    /async function deleteTask[\s\S]*?if \(!beginTaskAction\(id, "delete"\)\) return;[\s\S]*?finally \{[\s\S]*?endTaskAction\(id\)/,
  );
  assert.match(workspace, /disabled=\{Boolean\(pendingAction\)\}/);
  assert.match(
    workspace,
    /pendingTaskActions=\{pendingTaskActions\}/,
  );
  assert.match(
    deadlineBoard,
    /pendingTaskActions\.get\(task\.id\)[\s\S]*?disabled=\{Boolean\(pendingAction\)\}/,
  );
});

test("record deletion cannot be dismissed or resubmitted while pending", () => {
  assert.match(
    workspace,
    /async function deleteRecord[\s\S]*?if \(!beginRecordDelete\(id\)\) return;[\s\S]*?finally \{[\s\S]*?endRecordDelete\(id\)/,
  );
  assert.match(
    workspace,
    /function dismissDelete\(\)[\s\S]*?recordActionRegistry\.current\.has\(pendingDeleteId\)[\s\S]*?return;/,
  );
  assert.match(workspace, /onMouseDown=\{dismissDelete\}/);
  assert.match(workspace, /aria-busy=\{recordDeletePending\}/);
  assert.match(
    workspace,
    /onClick=\{dismissDelete\}[\s\S]*?disabled=\{recordDeletePending\}/,
  );
  assert.match(
    workspace,
    /onClick=\{\(\) => deleteRecord\(pendingDeleteRecord\.id\)\}[\s\S]*?disabled=\{recordDeletePending\}/,
  );
});
