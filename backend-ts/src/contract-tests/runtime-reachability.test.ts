import assert from "node:assert/strict";
import test from "node:test";
import { isInRuntimeReachabilityScope, runtimeReachabilityScope } from "./runtime-reachability";

test("runtime reachability begins at the application entry point", () => {
  assert.deepEqual(runtimeReachabilityScope.entryPoints, ["src/index.ts"]);
  assert.equal(isInRuntimeReachabilityScope("src/index.ts"), true);
  assert.equal(isInRuntimeReachabilityScope("src/modules/auth/auth.service.ts"), true);
});

test("runtime reachability excludes non-runtime and generated sources", () => {
  const excluded = [
    "src/auth-tests/auth.unit.test.ts",
    "src/scripts/create-indexes.ts",
    "src/migrations/legacy.ts",
    "src/cli/export.ts",
    "src/types/generated.d.ts",
    "src/fixtures/auth.json",
    "src/generated/corpus.ts",
  ];

  for (const path of excluded) {
    assert.equal(isInRuntimeReachabilityScope(path), false, path);
  }
});
