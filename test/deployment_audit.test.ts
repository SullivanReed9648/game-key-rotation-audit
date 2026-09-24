import test from "node:test";
import assert from "node:assert/strict";
import { deploymentsStillOnOldKey } from "../src/deployment_audit.js";

test("only the latest observation can block old-key retirement", () => {
  const pending = deploymentsStillOnOldKey([
    { deployment: "matchmaker-eu", observedKeyVersion: "old-v4", observedAt: "2026-09-22T08:00:00.000Z" },
    { deployment: "matchmaker-eu", observedKeyVersion: "new-v5", observedAt: "2026-09-22T08:05:00.000Z" },
    { deployment: "ugc-review-us", observedKeyVersion: "old-v4", observedAt: "2026-09-22T08:06:00.000Z" }
  ], "old-v4");

  assert.deepEqual(pending, ["ugc-review-us"]);
});
