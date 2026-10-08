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

const {
  remainingSettlementAmount,
  summarizeSettlements,
  upsertSettlementMutation,
} = compile("lib/settlement-mutation-state.ts");
const section = fs.readFileSync(
  path.join(root, "app/my/settlement-section.tsx"),
  "utf8",
);
const workspace = fs.readFileSync(
  path.join(root, "app/my/my-workspace.tsx"),
  "utf8",
);
const client = fs.readFileSync(
  path.join(root, "lib/workspace-client.ts"),
  "utf8",
);

const settlement = {
  record_id: 1,
  record_title: "Fixture campaign",
  record_platform: "Fixture",
  record_status: "selected",
  expected_cash_amount: null,
  expected_provided_value_amount: null,
  expected_points_amount: null,
  expected_reimbursement_amount: null,
  actual_cash_received_amount: null,
  actual_reimbursement_received_amount: null,
  cash_received_at: null,
  reimbursement_received_at: null,
  note: null,
  source_cash_amount: 30000,
  source_provided_value_amount: 50000,
  source_points_amount: 1000,
  source_reimbursement_amount: 12000,
};

function mutation(overrides = {}) {
  return {
    record_id: 1,
    expected_cash_amount: 0,
    expected_provided_value_amount: null,
    expected_points_amount: 0,
    expected_reimbursement_amount: null,
    actual_cash_received_amount: 0,
    actual_reimbursement_received_amount: null,
    cash_received_at: null,
    reimbursement_received_at: null,
    note: null,
    ...overrides,
  };
}

test("settlement mutation preserves record and source display context", () => {
  const next = upsertSettlementMutation(
    [settlement],
    mutation({ note: "Saved" }),
    settlement,
  );

  assert.equal(next.length, 1);
  assert.equal(next[0].note, "Saved");
  assert.equal(next[0].expected_cash_amount, 0);
  assert.equal(next[0].record_title, settlement.record_title);
  assert.equal(next[0].record_status, settlement.record_status);
  assert.equal(next[0].source_cash_amount, settlement.source_cash_amount);
});

test("same record response replaces one row without duplication", () => {
  let next = upsertSettlementMutation([settlement], mutation(), settlement);
  next = upsertSettlementMutation(
    next,
    mutation({ expected_cash_amount: 40000 }),
    settlement,
  );

  assert.equal(next.length, 1);
  assert.equal(next[0].expected_cash_amount, 40000);
});

test("late responses from different records preserve both successes", () => {
  const second = { ...settlement, record_id: 2, record_title: "Second" };
  const third = { ...settlement, record_id: 3, record_title: "Third" };

  let next = upsertSettlementMutation(
    [settlement],
    mutation({ record_id: 3, expected_cash_amount: 300 }),
    third,
  );
  next = upsertSettlementMutation(
    next,
    mutation({ record_id: 2, expected_cash_amount: 200 }),
    second,
  );

  assert.deepEqual(
    Array.from(next, (item) => item.record_id),
    [1, 3, 2],
  );
  assert.equal(next[1].expected_cash_amount, 300);
  assert.equal(next[2].expected_cash_amount, 200);
});

test("empty amounts stay unknown while zero is a known settled amount", () => {
  const unknown = settlement;
  const zero = {
    ...settlement,
    record_id: 2,
    expected_cash_amount: 0,
    actual_cash_received_amount: 0,
    expected_reimbursement_amount: 0,
    actual_reimbursement_received_amount: 0,
  };

  assert.equal(summarizeSettlements([unknown]).cashKnown, false);
  const summary = summarizeSettlements([unknown, zero]);
  assert.equal(summary.cashKnown, true);
  assert.equal(summary.reimbursementKnown, true);
  assert.equal(summary.cash, 0);
  assert.equal(summary.reimbursement, 0);
  assert.equal(summary.cashPending, 0);
  assert.equal(summary.reimbursementPending, 0);
});

test("summary excludes provided value and points and clamps overpayment", () => {
  const pending = {
    ...settlement,
    expected_cash_amount: 100,
    actual_cash_received_amount: 40,
    expected_reimbursement_amount: 80,
    actual_reimbursement_received_amount: 20,
    expected_provided_value_amount: 900000,
    expected_points_amount: 800000,
  };
  const overpaid = {
    ...settlement,
    record_id: 2,
    expected_cash_amount: 50,
    actual_cash_received_amount: 70,
    expected_reimbursement_amount: 30,
    actual_reimbursement_received_amount: 40,
  };
  const summary = summarizeSettlements([pending, overpaid]);

  assert.equal(remainingSettlementAmount(50, 70), 0);
  assert.equal(summary.cash, 60);
  assert.equal(summary.reimbursement, 60);
  assert.equal(summary.cashPending, 1);
  assert.equal(summary.reimbursementPending, 1);
});

test("settlement editor applies the typed response without a workspace fetch", () => {
  assert.match(client, /item: SettlementMutationItem/);
  assert.match(section, /const result = await saveSettlement/);
  assert.match(section, /onSaved\(result\.data\.item, item\)/);
  assert.doesNotMatch(section, /getWorkspace|reloadSettlements/);
  assert.match(
    workspace,
    /function reconcileSettlement[\s\S]*?setSettlements\(\(items\) =>[\s\S]*?upsertSettlementMutation/,
  );
  assert.match(
    workspace,
    /<SettlementSection items=\{settlements\} onSaved=\{reconcileSettlement\}/,
  );
});

test("same settlement form blocks synchronous duplicate submissions", () => {
  assert.match(section, /const saveLock = useRef\(false\)/);
  assert.match(
    section,
    /async function save[\s\S]*?if \(saveLock\.current\) return;[\s\S]*?saveLock\.current = true/,
  );
  assert.match(
    section,
    /finally \{[\s\S]*?saveLock\.current = false;[\s\S]*?setSaving\(false\)/,
  );
});

test("failed save keeps inputs and parent settlement state unchanged", () => {
  const saveHandler = section.slice(
    section.indexOf("async function save"),
    section.indexOf("return (", section.indexOf("async function save")),
  );
  const catchBlock = saveHandler.slice(
    saveHandler.indexOf("} catch {"),
    saveHandler.indexOf("} finally {"),
  );

  assert.doesNotMatch(catchBlock, /onSaved|setExpected|setActual|setCashReceivedAt|setReimbursementReceivedAt|setNote/);
  assert.doesNotMatch(catchBlock, /setMessage\("저장됨"\)/);
});
