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

const { upsertTaskMutation, removeTaskMutation } = compile(
  "lib/task-mutation-state.ts",
);
const calendar = fs.readFileSync(
  path.join(root, "app/calendar/calendar-workspace.tsx"),
  "utf8",
);
const client = fs.readFileSync(
  path.join(root, "lib/workspace-client.ts"),
  "utf8",
);

const original = {
  id: 7,
  record_id: 3,
  task_type: "visit",
  title: "Visit",
  due_at: "2026-10-10T00:00:00.000Z",
  completed_at: null,
  record_title: "Original campaign",
  record_platform: "Fixture",
};

test("created task gains the selected record display context", () => {
  const next = upsertTaskMutation(
    [original],
    {
      id: 8,
      record_id: 4,
      task_type: "content",
      title: "Write",
      due_at: "2026-10-11T00:00:00.000Z",
      completed_at: null,
    },
    {
      record_title: "New campaign",
      record_platform: "Fixture two",
    },
  );

  assert.equal(next.length, 2);
  assert.equal(next[1].id, 8);
  assert.equal(next[1].record_title, "New campaign");
  assert.equal(next[1].record_platform, "Fixture two");
});

test("same task id is replaced without losing existing record context", () => {
  const next = upsertTaskMutation(
    [original],
    {
      id: 7,
      record_id: 3,
      task_type: "submit",
      title: "Submit",
      due_at: "2026-10-12T00:00:00.000Z",
      completed_at: "2026-10-09T00:00:00.000Z",
    },
    {
      record_title: "Ignored fallback",
      record_platform: null,
    },
  );

  assert.equal(next.length, 1);
  assert.equal(next[0].title, "Submit");
  assert.equal(next[0].completed_at, "2026-10-09T00:00:00.000Z");
  assert.equal(next[0].record_title, "Original campaign");
  assert.equal(next[0].record_platform, "Fixture");
});

test("successful delete removes only the matching task", () => {
  const second = { ...original, id: 8, title: "Keep" };
  const next = removeTaskMutation([original, second], 7);

  assert.equal(next.length, 1);
  assert.equal(next[0].id, 8);
});

test("calendar consumes typed mutation responses without a follow-up fetch", () => {
  assert.match(client, /item: TaskMutationItem; created: boolean/);
  assert.match(client, /MutationEnvelope<\{ item: TaskMutationItem \}>/);
  assert.doesNotMatch(calendar, /getWorkspace|reloadTasks/);
  assert.match(
    calendar,
    /await createTaskRequest\([\s\S]*?setTasks\(\(items\) =>[\s\S]*?upsertTaskMutation/,
  );
  assert.match(
    calendar,
    /await updateTaskRequest\(editingTask\.id,[\s\S]*?upsertTaskMutation/,
  );
  assert.match(
    calendar,
    /await updateTaskRequest\(task\.id,[\s\S]*?upsertTaskMutation/,
  );
  assert.match(
    calendar,
    /await deleteTaskRequest\(id\);[\s\S]*?removeTaskMutation/,
  );
});

test("failed calendar requests preserve task state and form inputs", () => {
  const createHandler = calendar.slice(
    calendar.indexOf("async function createTask"),
    calendar.indexOf("function startEditingTask"),
  );
  const createCatch = createHandler.slice(
    createHandler.indexOf("} catch {"),
    createHandler.indexOf("} finally {"),
  );
  assert.doesNotMatch(createCatch, /setTasks|form\.reset|setFormOpen/);

  const editHandler = calendar.slice(
    calendar.indexOf("async function editTask"),
    calendar.indexOf("async function toggleTask"),
  );
  const editCatch = editHandler.slice(
    editHandler.indexOf("} catch {"),
    editHandler.indexOf("} finally {"),
  );
  assert.doesNotMatch(editCatch, /setTasks|setEditingTaskId/);
});
