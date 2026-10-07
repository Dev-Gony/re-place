const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const calendar = fs.readFileSync(
  path.join(root, "app/calendar/calendar-workspace.tsx"),
  "utf8",
);

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

test("calendar task registry serializes one task without blocking another", () => {
  const { createPendingActionRegistry } = compile("lib/pending-actions.ts");
  const registry = createPendingActionRegistry();

  assert.equal(registry.begin(11, "edit"), true);
  assert.equal(registry.begin(11, "toggle"), false);
  assert.equal(registry.begin(12, "delete"), true);
  assert.equal(registry.get(11), "edit");
  assert.equal(registry.get(12), "delete");

  registry.end(11);
  assert.equal(registry.begin(11, "toggle"), true);
});

test("calendar create uses a synchronous lock and form-only feedback", () => {
  assert.match(calendar, /taskCreateLock = useRef\(false\)/);
  assert.match(
    calendar,
    /if \(taskCreateLock\.current\) return;[\s\S]*?taskCreateLock\.current = true;/,
  );
  assert.match(
    calendar,
    /finally \{[\s\S]*?taskCreateLock\.current = false;[\s\S]*?setTaskCreatePending\(false\)/,
  );
  assert.match(calendar, /aria-busy=\{taskCreatePending\}/);
  assert.match(calendar, /disabled=\{taskCreatePending\}/);
});

test("calendar edit toggle and delete share task-scoped locks", () => {
  assert.match(
    calendar,
    /if \(!editingTask \|\| !beginTaskAction\(editingTask\.id, "edit"\)\) return;/,
  );
  assert.match(
    calendar,
    /if \(!beginTaskAction\(task\.id, "toggle"\)\) return;/,
  );
  assert.match(
    calendar,
    /if \(!beginTaskAction\(id, "delete"\)\) return;/,
  );
  assert.match(
    calendar,
    /finally \{[\s\S]*?endTaskAction\(editingTask\.id\)/,
  );
  assert.match(calendar, /endTaskAction\(task\.id\)/);
  assert.match(calendar, /endTaskAction\(id\)/);
  assert.doesNotMatch(calendar, /taskMutationPending/);
});

test("all calendar task surfaces consume the same per-task pending map", () => {
  assert.match(calendar, /pendingTaskActions\.get\(item\.task\.id\)/);
  assert.ok(
    (calendar.match(/pendingTaskActions\.get\(task\.id\)/g) ?? []).length >= 2,
  );
  assert.ok(
    (calendar.match(/disabled=\{Boolean\(pendingAction\)\}/g) ?? []).length >= 7,
  );
});

test("failed edits keep the form values and editing task available for retry", () => {
  assert.match(
    calendar,
    /await updateTaskRequest\(editingTask\.id,[\s\S]*?upsertTaskMutation\([\s\S]*?setEditingTaskId\(null\);[\s\S]*?catch \{[\s\S]*?setNotice\(/,
  );
  assert.match(calendar, /defaultValue=\{editingTask\.title\}/);
  assert.match(
    calendar,
    /defaultValue=\{seoulDateKey\(editingTask\.due_at\) \?\? ""\}/,
  );
  assert.match(calendar, /disabled=\{editingTaskPending\}/);
  assert.doesNotMatch(
    calendar,
    /catch \{[\s\S]{0,180}?setEditingTaskId\(null\)/,
  );
});
