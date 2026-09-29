const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadHealthRoute({ databaseUrl = 'postgresql://secret@example/db', queryError = null } = {}) {
  const source = fs.readFileSync(
    path.join(__dirname, '../app/api/health/db/route.ts'),
    'utf8',
  );

  const { outputText, diagnostics } = ts.transpileModule(source, {
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  });

  assert.equal(
    (diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error).length,
    0,
  );

  const calls = [];
  const responses = [];
  const errors = [];
  const exports = {};

  const env = {};
  if (databaseUrl !== undefined) env.DATABASE_URL = databaseUrl;

  const context = {
    exports,
    require(name) {
      if (name === 'next/server') {
        return {
          NextResponse: {
            json(body, init) {
              const response = { body, ...init };
              responses.push(response);
              return response;
            },
          },
        };
      }

      if (name === '@/lib/db') {
        return {
          async queryDb(text, values) {
            calls.push({ text, values });
            if (queryError) throw queryError;
            return { rows: [{ '?column?': 1 }] };
          },
        };
      }

      throw new Error('Unexpected dependency: ' + name);
    },
    process: { env },
    console: {
      error(message) {
        errors.push(message);
      },
    },
  };

  vm.runInNewContext(outputText, context, {
    filename: 'app/api/health/db/route.ts',
  });

  return { api: exports, calls, responses, errors };
}

test('healthy response exposes only ok and disables caching', async () => {
  const h = loadHealthRoute();
  const response = await h.api.GET();

  assert.deepEqual(response.body, { ok: true });
  assert.equal(response.status, 200);
  assert.equal(response.headers['Cache-Control'], 'no-store, max-age=0');
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].text, 'SELECT 1');

  const serialized = JSON.stringify(response.body);
  assert.doesNotMatch(serialized, /campaign|databaseurl|postgres|count|message|error/i);
});

test('missing DATABASE_URL returns the same minimal unavailable response', async () => {
  const h = loadHealthRoute({ databaseUrl: undefined });
  const response = await h.api.GET();

  assert.deepEqual(response.body, { ok: false });
  assert.equal(response.status, 503);
  assert.equal(response.headers['Cache-Control'], 'no-store, max-age=0');
  assert.equal(h.calls.length, 0);
  assert.deepEqual(h.errors, ['[Re:Place] database health check failed']);
});

test('database errors never expose driver details or credentials', async () => {
  const secretError = Object.assign(
    new Error('connect ECONNREFUSED postgresql://admin:super-secret@db.example/re-place'),
    { code: 'ECONNREFUSED' },
  );

  const h = loadHealthRoute({ queryError: secretError });
  const response = await h.api.GET();

  assert.deepEqual(response.body, { ok: false });
  assert.equal(response.status, 503);

  const exposed = JSON.stringify({
    response,
    errors: h.errors,
  });

  assert.doesNotMatch(exposed, /super-secret|admin|ECONNREFUSED|db\.example|postgresql/i);
  assert.deepEqual(h.errors, ['[Re:Place] database health check failed']);
});

test('health check query does not count campaign rows', async () => {
  const h = loadHealthRoute();
  await h.api.GET();

  assert.equal(h.calls.length, 1);
  assert.doesNotMatch(h.calls[0].text, /campaign|count|from/i);
});
