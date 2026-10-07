const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function compile(file, dependencies = {}) {
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
      Headers,
      Date,
      Intl,
      Map,
      Set,
      Object,
    },
    { filename: file },
  );
  return exports;
}

function fixtureHarness() {
  const owner = "11111111-1111-1111-1111-111111111111";
  const foreignOwner = "22222222-2222-2222-2222-222222222222";
  const records = [
    {
      id: 900,
      auth_user_id: foreignOwner,
      campaign_id: null,
      source_type: "manual",
      status: "saved",
      title: "Foreign fixture campaign",
      platform: "fixture",
      link: null,
      reward: null,
      region: null,
      deadline_at: "2026-10-12T00:00:00.000Z",
      note: null,
      created_at: "2026-10-07T00:00:00.000Z",
      updated_at: "2026-10-07T00:00:00.000Z",
    },
  ];
  const tasks = [];
  let nextRecordId = 1;
  let nextTaskId = 1;

  const client = {
    async query(sql, values = []) {
      const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();

      if (
        normalized.startsWith("select id from user_campaign_records") &&
        normalized.includes("for update")
      ) {
        const record = records.find(
          (item) =>
            item.auth_user_id === values[0] && item.id === Number(values[1]),
        );
        return { rows: record ? [{ id: record.id }] : [] };
      }

      if (normalized.startsWith("select * from user_campaign_tasks")) {
        const duplicate = tasks.find(
          (item) =>
            item.auth_user_id === values[0] &&
            item.record_id === Number(values[1]) &&
            item.task_type === values[2] &&
            item.title === values[3] &&
            item.due_at === new Date(values[4]).toISOString(),
        );
        return { rows: duplicate ? [{ ...duplicate }] : [] };
      }

      if (normalized.startsWith("insert into user_campaign_tasks")) {
        const item = {
          id: nextTaskId++,
          auth_user_id: values[0],
          record_id: Number(values[1]),
          task_type: values[2],
          title: values[3],
          due_at: new Date(values[4]).toISOString(),
          completed_at: null,
          created_at: "2026-10-07T00:00:00.000Z",
        };
        tasks.push(item);
        return { rows: [{ ...item }] };
      }

      throw new Error(`Unexpected transaction SQL: ${normalized}`);
    },
  };

  const db = {
    async queryDb(sql, values = []) {
      const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();

      if (normalized.startsWith("insert into user_campaign_records")) {
        const item = {
          id: nextRecordId++,
          auth_user_id: values[0],
          campaign_id: null,
          source_type: "manual",
          status: "saved",
          title: values[1],
          platform: values[2],
          link: values[3],
          reward: values[4],
          region: values[5],
          deadline_at: values[6],
          note: values[7],
          campaign_snapshot: JSON.parse(values[8]),
          created_at: "2026-10-07T00:00:00.000Z",
          updated_at: "2026-10-07T00:00:00.000Z",
        };
        records.push(item);
        return { rows: [{ ...item }] };
      }

      if (normalized.includes("from user_favorites")) return { rows: [] };

      if (
        normalized.startsWith("select id, campaign_id, source_type") &&
        normalized.includes("from user_campaign_records")
      ) {
        return {
          rows: records
            .filter((item) => item.auth_user_id === values[0])
            .map((item) => ({
              id: item.id,
              campaign_id: item.campaign_id,
              source_type: item.source_type,
              status: item.status,
              title: item.title,
              platform: item.platform,
              link: item.link,
              reward: item.reward,
              region: item.region,
              deadline_at: item.deadline_at,
              note: item.note,
            })),
        };
      }

      if (
        normalized.startsWith("select t.id") &&
        normalized.includes("from user_campaign_tasks")
      ) {
        return {
          rows: tasks
            .filter((item) => item.auth_user_id === values[0])
            .map((item) => {
              const record = records.find(
                (candidate) =>
                  candidate.id === item.record_id &&
                  candidate.auth_user_id === item.auth_user_id,
              );
              return {
                id: item.id,
                record_id: item.record_id,
                task_type: item.task_type,
                title: item.title,
                due_at: item.due_at,
                completed_at: item.completed_at,
                record_title: record.title,
                record_platform: record.platform,
              };
            }),
        };
      }

      if (normalized.startsWith("select r.id as record_id")) {
        return { rows: [] };
      }

      throw new Error(`Unexpected query SQL: ${normalized}`);
    },
    async withDbTransaction(run) {
      return run(client);
    },
  };

  const authServer = {
    auth: {
      async getSession() {
        return {
          data: { user: { id: owner, email: "fixture@example.invalid" } },
        };
      },
    },
  };
  const contract = { WORKSPACE_SCHEMA_VERSION: 1 };
  const privateData = compile("lib/private-data.ts", { "./db": db });
  const workspaceApi = compile("lib/workspace-api.ts", {
    "./auth/server": authServer,
    "./private-data": privateData,
    "./workspace-contract": contract,
  });
  const workspaceData = compile("lib/workspace-data.ts", {
    "./db": db,
    "./workspace-contract": contract,
  });
  const recordRoute = compile("app/api/v1/me/records/route.ts", {
    "../../../../../lib/db": db,
    "../../../../../lib/private-data": privateData,
    "../../../../../lib/workspace-api": workspaceApi,
  });
  const taskRoute = compile("app/api/v1/me/tasks/route.ts", {
    "../../../../../lib/db": db,
    "../../../../../lib/private-data": privateData,
    "../../../../../lib/workspace-api": workspaceApi,
  });
  const workspaceRoute = compile("app/api/v1/me/workspace/route.ts", {
    "../../../../../lib/auth/server": authServer,
    "../../../../../lib/private-data": privateData,
    "../../../../../lib/workspace-data": workspaceData,
  });
  const calendar = compile("lib/calendar-events.ts");

  return {
    owner,
    records,
    tasks,
    recordRoute,
    taskRoute,
    workspaceRoute,
    calendar,
  };
}

test("isolated owner can create a campaign task and see both dates on the calendar", async () => {
  const fixture = fixtureHarness();

  const invalidRecord = await fixture.recordRoute.POST(
    new Request("http://fixture/api/v1/me/records", {
      method: "POST",
      body: JSON.stringify({
        title: "Invalid fixture campaign",
        deadlineAt: "2026-02-30",
      }),
    }),
  );
  assert.equal(invalidRecord.status, 400);
  assert.equal(fixture.records.length, 1);

  const recordResponse = await fixture.recordRoute.POST(
    new Request("http://fixture/api/v1/me/records", {
      method: "POST",
      body: JSON.stringify({
        userId: "22222222-2222-2222-2222-222222222222",
        title: "Isolated fixture campaign",
        platform: "Fixture platform",
        deadlineAt: "2026-10-09",
      }),
    }),
  );
  assert.equal(recordResponse.status, 201);
  const recordBody = await recordResponse.json();
  const recordId = recordBody.data.item.id;
  assert.equal(recordBody.data.item.auth_user_id, fixture.owner);

  const invalidTask = await fixture.taskRoute.POST(
    new Request("http://fixture/api/v1/me/tasks", {
      method: "POST",
      body: JSON.stringify({
        recordId,
        taskType: "content",
        title: "Invalid date must not persist",
        dueAt: "2026-02-30",
      }),
    }),
  );
  assert.equal(invalidTask.status, 400);
  assert.equal(fixture.tasks.length, 0);

  const taskResponse = await fixture.taskRoute.POST(
    new Request("http://fixture/api/v1/me/tasks", {
      method: "POST",
      body: JSON.stringify({
        userId: "22222222-2222-2222-2222-222222222222",
        recordId,
        taskType: "content",
        title: "Publish fixture review",
        dueAt: "2026-10-10",
      }),
    }),
  );
  assert.equal(taskResponse.status, 201);
  assert.equal((await taskResponse.json()).data.created, true);

  const foreignTask = await fixture.taskRoute.POST(
    new Request("http://fixture/api/v1/me/tasks", {
      method: "POST",
      body: JSON.stringify({
        recordId: 900,
        taskType: "visit",
        title: "Must stay isolated",
        dueAt: "2026-10-11",
      }),
    }),
  );
  assert.equal(foreignTask.status, 404);

  const workspaceResponse = await fixture.workspaceRoute.GET();
  assert.equal(workspaceResponse.status, 200);
  assert.match(workspaceResponse.headers.get("cache-control"), /no-store/);
  const snapshot = await workspaceResponse.json();
  assert.equal(snapshot.records.length, 1);
  assert.equal(snapshot.records[0].title, "Isolated fixture campaign");
  assert.equal(snapshot.tasks.length, 1);
  assert.equal(snapshot.tasks[0].record_id, recordId);
  assert.equal(snapshot.tasks[0].record_title, "Isolated fixture campaign");

  const events = fixture.calendar.buildCalendarEventsByDate(
    snapshot.tasks,
    snapshot.records,
  );
  const deadlineEvents = events.get("2026-10-09");
  const taskEvents = events.get("2026-10-10");
  assert.equal(deadlineEvents.length, 1);
  assert.equal(deadlineEvents[0].kind, "deadline");
  assert.equal(deadlineEvents[0].key, `deadline-${recordId}`);
  assert.equal(taskEvents.length, 1);
  assert.equal(taskEvents[0].kind, "task");
  assert.equal(taskEvents[0].detail, "Isolated fixture campaign");

  assert.equal(fixture.records.length, 2);
  assert.equal(fixture.tasks.length, 1);
});
