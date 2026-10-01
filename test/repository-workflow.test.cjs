const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const branching = read("docs/BRANCHING.md");
const template = read("docs/specs/TEMPLATE.md");
const spec = read("docs/specs/RPL-037-repository-workflow.md");
const audit = read("docs/operations/RPL-037_BRANCH_AUDIT.md");
const agents = read("AGENTS.md");
const prTemplate = read(".github/pull_request_template.md");

test("repository workflow keeps main as the only long-lived branch", () => {
  assert.match(branching, /영구 브랜치는 `main` 하나/);
  assert.match(branching, /dev.*develop.*spec/s);
  assert.match(branching, /작업 branch 삭제|branch delete/);
  assert.match(agents, /docs\/specs\/RPL-XXX/);
});

test("spec template requires scope, tests, risk and completion criteria", () => {
  for (const heading of ["문제", "목표", "비목표", "사용자 흐름", "테스트", "위험과 롤백", "완료 조건"]) {
    assert.ok(template.includes(heading));
  }
});

test("RPL-037 records observed repository hygiene facts", () => {
  assert.match(spec, /기존 원격 branch: 90/);
  assert.match(spec, /delete_branch_on_merge.*false/);
  assert.match(spec, /main.*branch protection.*disabled/s);
  assert.match(audit, /merged PR의 head branch와 정확히 일치: \*\*87\*\*/);
  assert.match(audit, /91 branches/);
  assert.match(audit, /실행 후: 3 branches/);
  assert.match(audit, /branch unique commits: 0/);
  assert.match(audit, /PR #100/);
});

test("pull request template links work to issue, spec and cleanup", () => {
  assert.match(prTemplate, /Issue:/);
  assert.match(prTemplate, /Spec:/);
  assert.match(prTemplate, /Base SHA:/);
  assert.match(prTemplate, /작업 branch 삭제/);
});


test("branch hygiene keeps only main and cleans merged, contained, and retired branches", () => {
  const workflow = read(".github/workflows/branch-hygiene.yml");
  assert.match(workflow, /const keep = new Set\(\["main"\]\)/);
  assert.match(workflow, /const retired = new Set\(\["feat\/rpl-026-mobile-app-shell"\]\)/);
  assert.match(workflow, /compareCommits/);
  assert.match(workflow, /comparison\.data\.status === "ahead"/);
  assert.match(workflow, /comparison\.data\.behind_by === 0/);
});
