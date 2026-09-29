const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflowsDir = path.join(__dirname, '../.github/workflows');

function read(name) {
  return fs.readFileSync(path.join(workflowsDir, name), 'utf8');
}

test('pull request CI never receives a database credential', () => {
  const ci = read('ci.yml');

  assert.match(ci, /pull_request:/);
  assert.doesNotMatch(ci, /DATABASE_URL|PRODUCTION_DATABASE_URL|CI_DATABASE_URL/);
});

test('production database smoke is manual and production-scoped', () => {
  const workflow = read('neon-migration-check.yml');

  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /pull_request:/);
  assert.match(workflow, /environment:\s*production/);
  assert.match(workflow, /secrets\.PRODUCTION_DATABASE_URL/);
  assert.doesNotMatch(workflow, /count\(\*\)|from campaigns/i);
});

test('scheduled collectors use only the production-scoped secret', () => {
  const workflow = read('collect-campaigns.yml');

  assert.match(workflow, /environment:\s*production/);
  assert.match(workflow, /DATABASE_URL:\s*\$\{\{ secrets\.PRODUCTION_DATABASE_URL \}\}/);
  assert.doesNotMatch(workflow, /secrets\.DATABASE_URL/);
});

test('legacy duplicate pull-request workflows are removed', () => {
  for (const name of ['cost-regression.yml', 'health-security.yml']) {
    assert.equal(fs.existsSync(path.join(workflowsDir, name)), false, name);
  }
});
