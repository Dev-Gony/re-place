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
      Date,
      Intl,
      Number,
    },
    { filename: file },
  );
  return exports;
}

const deadline = compile("lib/private-data.ts", {
  "./db": { queryDb: async () => ({ rows: [] }) },
});
const taskDate = compile("lib/task-date.ts");

test("date-only input accepts real calendar dates without rollover", () => {
  assert.equal(
    deadline.normalizeDeadline("2028-02-29"),
    "2028-02-29T00:00:00.000Z",
  );
  assert.equal(deadline.normalizeDeadline("2026-02-29"), null);
  assert.equal(deadline.normalizeDeadline("2026-04-31"), null);
  assert.equal(deadline.normalizeDeadline("2026-00-10"), null);
  assert.equal(deadline.normalizeDeadline("2026-1-10"), null);
});

test("timestamp input requires an explicit valid timezone", () => {
  assert.equal(
    deadline.normalizeDeadline("2026-10-03T00:00:00+09:00"),
    "2026-10-02T15:00:00.000Z",
  );
  assert.equal(
    deadline.normalizeDeadline("2026-10-02T15:00:00.123Z"),
    "2026-10-02T15:00:00.123Z",
  );
  assert.equal(deadline.normalizeDeadline("2026-10-03T00:00:00"), null);
  assert.equal(deadline.normalizeDeadline("10/03/2026"), null);
  assert.equal(
    deadline.normalizeDeadline("2026-10-03T00:00:00+14:01"),
    null,
  );
  assert.equal(deadline.normalizeDeadline("2026-10-03T24:00:00Z"), null);
});

test("optional deadline distinguishes clearing from invalid input", () => {
  assert.equal(deadline.normalizeOptionalDeadline(undefined), null);
  assert.equal(deadline.normalizeOptionalDeadline(null), null);
  assert.equal(deadline.normalizeOptionalDeadline("  "), null);
  assert.equal(
    deadline.normalizeOptionalDeadline("2026-12-31"),
    "2026-12-31T00:00:00.000Z",
  );
  assert.equal(deadline.normalizeOptionalDeadline(20261003), undefined);
  assert.equal(deadline.normalizeOptionalDeadline("2026-02-30"), undefined);
});

test("normalized timezone input lands on the intended Seoul calendar date", () => {
  const normalized = deadline.normalizeDeadline(
    "2026-10-03T00:00:00+09:00",
  );
  assert.equal(normalized, "2026-10-02T15:00:00.000Z");
  assert.equal(taskDate.seoulDateKey(normalized), "2026-10-03");
  assert.equal(
    taskDate.seoulDateKey(deadline.normalizeDeadline("2026-10-03")),
    "2026-10-03",
  );
});
