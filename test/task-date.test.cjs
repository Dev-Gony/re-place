const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function loadDateHelper() {
  const source = fs.readFileSync(
    path.join(__dirname, "../lib/task-date.ts"),
    "utf8",
  );
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
  vm.runInNewContext(outputText, { exports, Intl, Date, Number });
  return exports;
}

test("Seoul date keys stay stable across UTC day boundaries", () => {
  const { seoulDateKey } = loadDateHelper();

  assert.equal(seoulDateKey("2026-10-02T15:00:00.000Z"), "2026-10-03");
  assert.equal(seoulDateKey("2026-10-03T14:59:59.999Z"), "2026-10-03");
  assert.equal(seoulDateKey("2026-10-03T15:00:00.000Z"), "2026-10-04");
  assert.equal(seoulDateKey("2026-10-03"), "2026-10-03");
  assert.equal(seoulDateKey("not-a-date"), null);
});
