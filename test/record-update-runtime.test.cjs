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
      Number,
      Object,
      Set,
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
      id: 1,
      auth_user_id: owner,
      status: "selected",
      note: "Keep this private note",
      deadline_at: "2026-10-20T00:00:00.000Z",
    },
    {
      id: 2,
      auth_user_id: foreignOwner,
      status: "selected",
      note: "Foreign private note",
      deadline_at: "2026-10-21T00:00:00.000Z",
    },
  ];

  const db = {
    async queryDb(sql, values = []) {
      const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();
      if (!normalized.startsWith("update user_campaign_records")) {
        throw new Error(`Unexpected SQL: ${normalized}`);
      }

      const record = records.find(
        (item) =>
          item.auth_user_id === values[0] && item.id === Number(values[1]),
      );
      if (!record) return { rows: [] };

      record.status = values[2];
      if (values[3]) record.note = values[4];
      if (values[5]) record.deadline_at = values[6];
      return { rows: [{ ...record }] };
    },
  };
  const privateData = compile("lib/private-data.ts", { "./db": db });
  const authServer = {
    auth: {
      async getSession() {
        return { data: { user: { id: owner } } };
      },
    },
  };
  const workspaceApi = compile("lib/workspace-api.ts", {
    "./auth/server": authServer,
    "./private-data": privateData,
    "./workspace-contract": { WORKSPACE_SCHEMA_VERSION: 1 },
  });
  const route = compile("app/api/v1/me/records/[id]/route.ts", {
    "../../../../../../lib/db": db,
    "../../../../../../lib/private-data": privateData,
    "../../../../../../lib/workspace-api": workspaceApi,
  });

  async function patch(id, body) {
    return route.PATCH(
      new Request(`http://fixture/api/v1/me/records/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id: String(id) }) },
    );
  }

  return { records, patch };
}

test("status-only record update preserves private note and deadline", async () => {
  const fixture = fixtureHarness();

  const response = await fixture.patch(1, { status: "review_pending" });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.data.item.status, "review_pending");
  assert.equal(payload.data.item.note, "Keep this private note");
  assert.equal(payload.data.item.deadline_at, "2026-10-20T00:00:00.000Z");
});

test("explicit note update trims text and can intentionally clear it", async () => {
  const fixture = fixtureHarness();

  const update = await fixture.patch(1, {
    status: "review_pending",
    note: "  Updated note  ",
  });
  assert.equal(update.status, 200);
  assert.equal((await update.json()).data.item.note, "Updated note");

  const clear = await fixture.patch(1, {
    status: "completed",
    note: "",
  });
  assert.equal(clear.status, 200);
  assert.equal((await clear.json()).data.item.note, null);
});

test("invalid note is rejected and foreign record remains hidden", async () => {
  const fixture = fixtureHarness();

  const invalid = await fixture.patch(1, {
    status: "review_pending",
    note: { unsafe: true },
  });
  assert.equal(invalid.status, 400);
  assert.equal(fixture.records[0].note, "Keep this private note");

  const foreign = await fixture.patch(2, {
    status: "completed",
    note: "Must not change",
  });
  assert.equal(foreign.status, 404);
  assert.equal(fixture.records[1].status, "selected");
  assert.equal(fixture.records[1].note, "Foreign private note");
});
