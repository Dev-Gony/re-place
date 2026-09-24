const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, dependencies, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const { outputText, diagnostics } = ts.transpileModule(source, {
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  assert.equal((diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
  const exports = {};
  vm.runInNewContext(outputText, { exports, require: name => {
    if (!(name in dependencies)) throw new Error('Unexpected dependency: ' + name);
    return dependencies[name];
  }, console, ...globals }, { filename: file });
  return exports;
}

function database(env = { NODE_ENV: 'production', DATABASE_URL: 'postgresql://test' }) {
  const pools = [];
  class Pool {
    constructor(options) { this.options = options; this.calls = []; pools.push(this); }
    on(event, listener) { this.event = event; this.listener = listener; }
    async query(text, values) {
      this.calls.push({ text, values });
      if (text === 'FAIL') throw new Error('query failure');
      return { rows: [{ ok: true }] };
    }
  }
  return { pools, api: load('lib/db.ts', { pg: { Pool } }, { process: { env } }) };
}

test('production shares one bounded pool across concurrent requests', async () => {
  const { pools, api } = database();
  await Promise.all(Array.from({ length: 20 }, () => api.queryDb('SELECT 1')));
  assert.equal(pools.length, 1);
  assert.equal(pools[0].calls.length, 20);
  assert.equal(pools[0].options.max, 3);
  assert.equal(pools[0].options.idleTimeoutMillis, 10000);
  assert.equal(pools[0].options.statement_timeout, 15000);
  assert.equal(pools[0].event, 'error');
});

test('query parameters remain bound and caller arrays are not mutated', async () => {
  const { pools, api } = database();
  const values = Object.freeze(["x' OR 1=1 --"]);
  await api.queryDb('SELECT * FROM campaigns WHERE title = $1', values);
  assert.equal(pools[0].calls[0].values[0], values[0]);
  assert.notEqual(pools[0].calls[0].values, values);
  assert.match(pools[0].calls[0].text, /\$1/);
});

test('missing configuration fails before creating a connection', () => {
  const { pools, api } = database({ NODE_ENV: 'production' });
  assert.throws(() => api.queryDb('SELECT 1'), /DATABASE_URL/);
  assert.equal(pools.length, 0);
});

test('database errors are propagated, not replaced with empty success', async () => {
  await assert.rejects(database().api.queryDb('FAIL'), /query failure/);
});

function cacheHarness() {
  const memo = new Map();
  const calls = [];
  let options;
  let fail = false;
  const api = load('lib/campaign-cache.ts', {
    './db': { queryDb: async (text, values) => {
      calls.push({ text, values });
      if (fail) throw new Error('offline');
      return { rows: [{ text, value: values[0] || null }], fields: [() => {}] };
    } },
    'next/cache': { unstable_cache: (fn, keys, config) => {
      options = config;
      return async (...args) => {
        const key = JSON.stringify([keys, args]);
        if (!memo.has(key)) memo.set(key, JSON.parse(JSON.stringify(await fn(...args))));
        return memo.get(key);
      };
    } },
  });
  return { api, calls, options, setFail: value => { fail = value; } };
}

test('public reads reuse identical keys and isolate different filters', async () => {
  const h = cacheHarness();
  const sql = 'SELECT title FROM campaigns WHERE region = $1';
  await h.api.queryCampaignDb(sql, ['A']);
  await h.api.queryCampaignDb(sql, ['A']);
  await h.api.queryCampaignDb(sql, ['B']);
  assert.equal(h.calls.length, 2);
  assert.equal(h.options.revalidate, 600);
});

test('only rows enter the public cache', async () => {
  const h = cacheHarness();
  const result = await h.api.queryCampaignDb('SELECT count(*) FROM campaigns');
  assert.deepEqual(Object.keys(result), ['rows']);
});

test('failed cache fills are retried and not stored as empty rows', async () => {
  const h = cacheHarness();
  h.setFail(true);
  await assert.rejects(h.api.queryCampaignDb('SELECT 1'), /offline/);
  h.setFail(false);
  const result = await h.api.queryCampaignDb('SELECT 1');
  assert.equal(result.rows.length, 1);
  assert.equal(h.calls.length, 2);
});
