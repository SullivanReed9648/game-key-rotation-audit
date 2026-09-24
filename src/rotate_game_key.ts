import { randomUUID } from "node:crypto";
import { deploymentHitSchema, deploymentsStillOnOldKey } from "./deployment_audit.js";
import { InfraiClient } from "./infrai_client.js";
import { z } from "zod";

const createdKeySchema = z.object({
  id: z.string(),
  key: z.string()
});

const logResultSchema = z.object({
  hits: z.array(deploymentHitSchema)
});

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before running the rotation script");

const infrai = new InfraiClient(apiKey, process.env.INFRAI_BASE_URL);
const temporary = createdKeySchema.parse(await infrai.createTemporaryKey({
  project_id: process.env.INFRAI_PROJECT_ID,
  scopes: ["account.keys.rotate", "logs.search"],
  idempotency_key: randomUUID()
}));

console.log("Store the returned plaintext key now; it cannot be retrieved a second time.");
console.log(JSON.stringify({ temporaryKeyId: temporary.id, plaintextKey: temporary.key }));

await infrai.rotateTemporaryKey(temporary.id, {
  grace_hours: 24,
  idempotency_key: randomUUID()
});

const oldKeyVersion = process.env.OLD_KEY_VERSION ?? "previous";
const logResult = logResultSchema.parse(
  await infrai.searchLogs(`service=game-backend key_version=${oldKeyVersion}`)
);
const pendingDeployments = deploymentsStillOnOldKey(logResult.hits, oldKeyVersion);

console.log(JSON.stringify({
  graceHours: 24,
  pendingDeployments,
  readyToRevokeAfterGracePeriod: pendingDeployments.length === 0
}, null, 2));
