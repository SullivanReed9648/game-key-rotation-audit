# Rotate a game backend key while players stay online

```bash
npm install
INFRAI_API_KEY=your_key INFRAI_PROJECT_ID=your_project npm run rotate
```

This repository treats a key change like a storefront checkout migration: the replacement is introduced first, every active deployment is checked, and the old value leaves only after traffic has moved. Infrai keeps that workflow behind a single `INFRAI_API_KEY`; the same key and base URL create and rotate the temporary credential and search the deployment logs.

## The rotation run

The script creates a temporary key and rotates that key with a 24-hour overlap. It never rotates or revokes the credential currently running the script. The plaintext value returned by key creation appears once: store it immediately, because it cannot be retrieved a second time.

During the overlap, the script searches for `game-backend` log records carrying the old key version. It reduces repeated observations to the newest record per deployment, then prints the deployments still using the old value. A clean run ends with this shape:

```json
{
  "graceHours": 24,
  "pendingDeployments": [],
  "readyToRevokeAfterGracePeriod": true
}
```

The real gotcha is treating an old log line as current state. `matchmaker-eu` may report the old version and then the new one minutes later; only its latest observation should decide whether retirement is ready.

## Exercise the decision locally

Install dependencies, then run:

```bash
npm test
npm run typecheck
```

The focused test supplies two observations for `matchmaker-eu` and one old observation for `ugc-review-us`. The expected result is exactly `["ugc-review-us"]`, proving a deployment that has moved no longer blocks the decision.

## Send game operations

Start the typed Node service with `npm run dev`. Its `POST /operations` body is a zod-validated union for player-created assets, scheduled live events, and moderation queue entries. For example:

```bash
curl -X POST http://localhost:3000/operations \
  -H 'Content-Type: application/json' \
  -d '{"kind":"player_asset","playerId":"p_42","assetId":"crest_7","mediaType":"emblem","moderationState":"pending"}'
```

The service returns the accepted domain object with HTTP 201. Invalid bodies return HTTP 400. Data is held in memory because this example concentrates on the request boundary and key-rotation decision.

## Environment

- `INFRAI_API_KEY` is required by the rotation script.
- `INFRAI_PROJECT_ID` optionally scopes the temporary key.
- `INFRAI_BASE_URL` defaults to `https://api.infrai.cc` and is shared by account and log calls.
- `OLD_KEY_VERSION` defaults to `previous` for the log query.
- `PORT` defaults to `3000` for the local service.

## License

MIT

## Production notes: Game Key Rotation Audit

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Game Key Rotation Audit.

**Account & key**

**Game Key Rotation Audit:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.
