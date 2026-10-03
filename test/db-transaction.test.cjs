const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function database() {
  const source = fs.readFileSync(path.join(__dirname, "../lib/db.ts"), "utf8");
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

  const clients = [];
  class Pool {
    on() {}

    async connect() {
      const client = {
        calls: [],
        released: false,
        async query(text) {
          this.calls.push(text);
          return { rows: [] };
        },
        release() {
          this.released = true;
        },
      };
      clients.push(client);
      return client;
    }
  }

  const exports = {};
  vm.runInNewContext(
    outputText,
    {
      exports,
      require(name) {
        if (name === "pg") return { Pool };
        throw new Error("Unexpected dependency: " + name);
      },
      process: { env: { DATABASE_URL: "postgresql://test" } },
      console,
    },
    { filename: "lib/db.ts" },
  );

  return { api: exports, clients };
}

test("transaction commits and releases its checked-out client", async () => {
  const h = database();
  const result = await h.api.withDbTransaction(async (client) => {
    await client.query("SELECT 1");
    return 42;
  });

  assert.equal(result, 42);
  assert.deepEqual(h.clients[0].calls, ["BEGIN", "SELECT 1", "COMMIT"]);
  assert.equal(h.clients[0].released, true);
});

test("transaction rolls back and releases when the callback fails", async () => {
  const h = database();

  await assert.rejects(
    h.api.withDbTransaction(async (client) => {
      await client.query("SELECT 1");
      throw new Error("callback failed");
    }),
    /callback failed/,
  );

  assert.deepEqual(h.clients[0].calls, ["BEGIN", "SELECT 1", "ROLLBACK"]);
  assert.equal(h.clients[0].released, true);
});
