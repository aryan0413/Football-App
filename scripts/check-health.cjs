const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync(require("node:path").join(__dirname, "../app/api/health/route.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

function loadRoute(getSupabaseAdmin) {
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    Response,
    AbortSignal,
    require(name) {
      assert.equal(name, "@/lib/supabase");
      return { getSupabaseAdmin };
    }
  });
  return exports.GET;
}

function databaseResult(result) {
  return () => ({
    from() {
      return {
        select(_columns, options) {
          assert.equal(options.head, true);
          return {
            limit() {
              return {
                abortSignal(signal) {
                  assert.ok(signal instanceof AbortSignal);
                  return Promise.resolve(result);
                }
              };
            }
          };
        }
      };
    }
  });
}

(async () => {
  const healthy = await loadRoute(databaseResult({ error: null }))();
  assert.equal(healthy.status, 200);
  assert.deepEqual(await healthy.json(), { ok: true, database: "available" });
  assert.equal(healthy.headers.get("Cache-Control"), "no-store");

  for (const error of [
    { message: "TypeError: fetch failed", code: "ENOTFOUND" },
    { message: "Timed out", code: "AbortError" },
    { message: "Invalid API key", code: "401" },
    { message: "Table does not exist", code: "PGRST205" }
  ]) {
    const unavailable = await loadRoute(databaseResult({ error }))();
    assert.equal(unavailable.status, 503);
    assert.equal(unavailable.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(await unavailable.json(), { ok: false, database: "unavailable" });
  }

  const misconfigured = await loadRoute(() => { throw new Error("Missing private configuration"); })();
  assert.equal(misconfigured.status, 503);
  assert.deepEqual(await misconfigured.json(), { ok: false, database: "unavailable" });
  console.log("Health checks passed: database reachable, DNS failure, timeout, invalid key, missing table, missing configuration.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
