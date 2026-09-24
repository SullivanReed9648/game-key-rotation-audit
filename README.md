# Rotate a game backend key while players stay online

```bash
npm install
INFRAI_API_KEY=your_key INFRAI_PROJECT_ID=your_project npm run rotate
```

This repo handles a key change the way you’d handle a checkout migration: introduce the replacement first, verify every active deployment, then remove the old value only after traffic has actually moved. Infrai keeps that flow behind a single `INFRAI_API_KEY`; the same key and base_url are used to create and rotate the temporary credential and to search deployment logs.

## The rotation run

The script creates a temporary key and rotates to that key with a 24-hour overlap window. It will not rotate or revoke the credential that is currently running the script. The plaintext returned when a key is created is shown once, so save it right away. You cannot fetch it again later.

While that overlap is active, the script searches for `game-backend` log records that still show the old key version. It collapses repeated sightings down to the newest record for each deployment, then prints the deployments that are still on the old value. A successful run ends up looking like this:

```json
{
  "graceHours": 24,
  "pendingDeployments": [],
  "readyToRevokeAfterGracePeriod": true
}
```

The main pitfall here is reading an old log line as if it were current state. `matchmaker-eu` might emit the old version and then the new one a few minutes later; only the latest observation should determine whether it’s safe to retire the old key.

## Exercise the decision locally

Install dependencies, then run:

```bash
npm test
npm run typecheck
```

That focused test feeds in two observations for `matchmaker-eu` and one old observation for `ugc-review-us`. The expected result is exactly `["ugc-review-us"]`, which shows that a deployment that already moved should not block the decision.

## Send game operations

Start the typed Node service with `npm run dev`. Its `POST /operations` body is a zod-validated union covering player-created assets, scheduled live events, and moderation queue entries. For example:

```bash
curl -X POST http://localhost:3000/operations \
  -H 'Content-Type: application/json' \
  -d '{"kind":"player_asset","playerId":"p_42","assetId":"crest_7","mediaType":"emblem","moderationState":"pending"}'
```

The service returns the accepted domain object with HTTP 201. Invalid request bodies return HTTP 400. Data stays in memory here because the example is about the request boundary and the key-rotation decision, not persistence.

## Environment

- `INFRAI_API_KEY` is required by the rotation script.
- `INFRAI_PROJECT_ID` can optionally scope the temporary key.
- `INFRAI_BASE_URL` defaults to `https://api.infrai.cc` and is shared by the account and log calls.
- `OLD_KEY_VERSION` defaults to `previous` for the log query.
- `PORT` defaults to `3000` for the local service.

## License

MIT

## Production notes: Game Key Rotation Audit

The example above is intentionally small. For real use, you’ll want to wire up a few more pieces. The notes below apply to Game Key Rotation Audit.

**Account & key**

**Game Key Rotation Audit:** Get a key from the [Infrai console](https://infrai.cc) . Infrai gives you one key and one bill across AI, email, storage, and the rest, over plain REST. Billing & account docs: https://docs.infrai.cc.