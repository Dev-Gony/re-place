const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function compile(file, dependencies) {
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
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
  vm.runInNewContext(
    outputText,
    {
      exports,
      require(name) {
        if (!(name in dependencies)) {
          throw new Error(`Unexpected dependency in ${file}: ${name}`);
        }
        return dependencies[name];
      },
      Request,
      Response,
      Date,
      Object,
      Set,
    },
    { filename: file },
  );
  return exports;
}

function harness() {
  const owner = "11111111-1111-1111-1111-111111111111";
  const records = new Map([
    [7, { id: 7, auth_user_id: owner, title: "Sample campaign" }],
  ]);
  const tasks = [];
  let nextId = 1;

  const client = {
    async query(sql, values = []) {
      const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();

      if (
        normalized.startsWith("select id from user_campaign_records") &&
        normalized.includes("for update")
      ) {
        const record = records.get(Number(values[1]));
        return {
          rows:
            record && record.auth_user_id === values[0]
              ? [{ id: record.id }]
              : [],
        };
      }

      if (
        normalized.startsWith("select * from user_campaign_tasks") &&
        normalized.includes("record_id = $2")
      ) {
        const dueAt = new Date(values[4]).toISOString();
        const item = tasks.find(
          (task) =>
            task.auth_user_id === values[0] &&
            task.record_id === Number(values[1]) &&
            task.task_type === values[2] &&
            task.title === values[3] &&
            task.due_at === dueAt,
        );
        return { rows: item ? [{ ...item }] : [] };
      }

      if (normalized.startsWith("insert into user_campaign_tasks")) {
        const item = {
          id: nextId++,
          auth_user_id: values[0],
          record_id: Number(values[1]),
          task_type: values[2],
          title: values[3],
          due_at: new Date(values[4]).toISOString(),
          completed_at: null,
        };
        tasks.push(item);
        return { rows: [{ ...item }] };
      }

      if (
        normalized.startsWith("select * from user_campaign_tasks") &&
        normalized.includes("id = $2")
      ) {
        const item = tasks.find(
          (task) =>
            task.auth_user_id === values[0] &&
            task.id === Number(values[1]),
        );
        return { rows: item ? [{ ...item }] : [] };
      }

      if (
        normalized.startsWith("select id from user_campaign_tasks") &&
        normalized.includes("id <> $2")
      ) {
        const dueAt = new Date(values[5]).toISOString();
        const item = tasks.find(
          (task) =>
            task.auth_user_id === values[0] &&
            task.id !== Number(values[1]) &&
            task.record_id === Number(values[2]) &&
            task.task_type === values[3] &&
            task.title === values[4] &&
            task.due_at === dueAt,
        );
        return { rows: item ? [{ id: item.id }] : [] };
      }

      if (normalized.startsWith("update user_campaign_tasks")) {
        const item = tasks.find(
          (task) =>
            task.auth_user_id === values[0] &&
            task.id === Number(values[1]),
        );
        if (!item) return { rows: [] };
        item.task_type = values[2];
        item.title = values[3];
        item.due_at = new Date(values[4]).toISOString();
        if (values[5] === true && !item.completed_at) {
          item.completed_at = "2026-10-03T09:00:00.000Z";
        } else if (values[5] === false) {
          item.completed_at = null;
        }
        return { rows: [{ ...item }] };
      }

      if (normalized.startsWith("delete from user_campaign_tasks")) {
        const index = tasks.findIndex(
          (task) =>
            task.auth_user_id === values[0] &&
            task.id === Number(values[1]),
        );
        if (index < 0) return { rows: [] };
        const [item] = tasks.splice(index, 1);
        return { rows: [{ id: item.id }] };
      }

      throw new Error(`Unexpected SQL: ${normalized}`);
    },
  };

  const db = {
    async withDbTransaction(run) {
      return run(client);
    },
  };
  const privateData = {
    normalizeDeadline(value) {
      if (typeof value !== "string" || !value.trim()) return null;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    },
    normalizeOptionalText(value, max = 2000) {
      if (typeof value !== "string") return null;
      const text = value.trim();
      return text ? text.slice(0, max) : null;
    },
    privateHeaders() {
      return { "Cache-Control": "private, no-store" };
    },
  };
  const api = {
    async currentOwnerId() {
      return owner;
    },
    positiveId(value) {
      const id = Number(value);
      return Number.isInteger(id) && id > 0 ? id : null;
    },
    v1Error(code, message, status) {
      return Response.json({ error: { code, message } }, { status });
    },
    v1Mutation(data, status = 200) {
      return Response.json(
        {
          schemaVersion: 1,
          mutatedAt: "2026-10-03T09:00:00.000Z",
          data,
        },
        { status },
      );
    },
  };

  const list = compile("app/api/v1/me/tasks/route.ts", {
    "../../../../../lib/db": db,
    "../../../../../lib/private-data": privateData,
    "../../../../../lib/workspace-api": api,
  });
  const item = compile("app/api/v1/me/tasks/[id]/route.ts", {
    "../../../../../../lib/db": db,
    "../../../../../../lib/private-data": privateData,
    "../../../../../../lib/workspace-api": api,
  });
  const workspace = compile("app/api/v1/me/workspace/route.ts", {
    "../../../../../lib/auth/server": {
      auth: {
        async getSession() {
          return { data: { user: { id: owner } } };
        },
      },
    },
    "../../../../../lib/private-data": privateData,
    "../../../../../lib/workspace-data": {
      async loadWorkspace(requestOwner) {
        assert.equal(requestOwner, owner);
        return {
          schemaVersion: 1,
          syncedAt: "2026-10-03T09:00:00.000Z",
          favorites: [],
          records: [...records.values()],
          tasks: tasks.map((task) => ({
            ...task,
            record_title: records.get(task.record_id).title,
            record_platform: null,
          })),
          settlements: [],
        };
      },
    },
  });

  return { list, item, workspace, tasks };
}

async function body(response) {
  return response.json();
}

test("task routes run add, deduplicate, edit, complete, delete and reload", async () => {
  const h = harness();
  const input = {
    recordId: 7,
    taskType: "visit",
    title: "Visit store",
    dueAt: "2026-10-03",
  };

  const created = await h.list.POST(
    new Request("http://test/tasks", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
  assert.equal(created.status, 201);
  assert.equal((await body(created)).data.created, true);
  assert.equal(h.tasks.length, 1);

  const duplicate = await h.list.POST(
    new Request("http://test/tasks", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
  assert.equal(duplicate.status, 200);
  assert.equal((await body(duplicate)).data.created, false);
  assert.equal(h.tasks.length, 1);

  const second = await h.list.POST(
    new Request("http://test/tasks", {
      method: "POST",
      body: JSON.stringify({ ...input, title: "Second task" }),
    }),
  );
  assert.equal(second.status, 201);
  assert.equal(h.tasks.length, 2);

  const conflict = await h.item.PATCH(
    new Request("http://test/tasks/2", {
      method: "PATCH",
      body: JSON.stringify({
        taskType: input.taskType,
        title: input.title,
        dueAt: input.dueAt,
      }),
    }),
    { params: Promise.resolve({ id: "2" }) },
  );
  assert.equal(conflict.status, 409);
  assert.equal((await body(conflict)).error.code, "CONFLICT");
  assert.equal(h.tasks[1].title, "Second task");

  const removedSecond = await h.item.DELETE(
    new Request("http://test/tasks/2", { method: "DELETE" }),
    { params: Promise.resolve({ id: "2" }) },
  );
  assert.equal(removedSecond.status, 200);
  assert.equal(h.tasks.length, 1);

  const edited = await h.item.PATCH(
    new Request("http://test/tasks/1", {
      method: "PATCH",
      body: JSON.stringify({
        taskType: "content",
        title: "Publish review",
        dueAt: "2026-10-04",
      }),
    }),
    { params: Promise.resolve({ id: "1" }) },
  );
  assert.equal(edited.status, 200);
  assert.equal(h.tasks[0].task_type, "content");
  assert.equal(h.tasks[0].title, "Publish review");
  assert.equal(h.tasks[0].due_at, "2026-10-04T00:00:00.000Z");

  const completed = await h.item.PATCH(
    new Request("http://test/tasks/1", {
      method: "PATCH",
      body: JSON.stringify({ completed: true }),
    }),
    { params: Promise.resolve({ id: "1" }) },
  );
  assert.equal(completed.status, 200);
  assert.equal(h.tasks[0].completed_at, "2026-10-03T09:00:00.000Z");

  const reloaded = await h.workspace.GET();
  const snapshot = await body(reloaded);
  assert.equal(snapshot.tasks.length, 1);
  assert.equal(snapshot.tasks[0].title, "Publish review");
  assert.equal(snapshot.tasks[0].completed_at, "2026-10-03T09:00:00.000Z");

  const deleted = await h.item.DELETE(
    new Request("http://test/tasks/1", { method: "DELETE" }),
    { params: Promise.resolve({ id: "1" }) },
  );
  assert.equal(deleted.status, 200);

  const afterDelete = await body(await h.workspace.GET());
  assert.deepEqual(afterDelete.tasks, []);
});
