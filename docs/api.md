# API documentation

## Replay event stream (WebSocket)

The backend pushes replay progress and timing over a WebSocket while a session is being replayed. Clients connect to the replay events endpoint.

Every message is a single JSON object.

### Message shape

| Field        | Type   | Required | Description |
|-------------|--------|----------|-------------|
| `replayId`  | string | yes      | Identifier for this replay run (matches path param `{replayId}`). |
| `sessionId` | string | yes      | Session whose events are being replayed. |
| `seq`       | number | yes      | Current event sequence position in the replay (non-negative integer). |
| `state`     | string | yes      | One of: `running`, `paused`, `done`. |
| `speed`     | number | yes      | Current playback speed multiplier (e.g. `1` for 1×). |
| `elapsedMs` | number | yes      | Elapsed time since replay start for the current position, in milliseconds. |
| `ts`        | string | yes      | Server timestamp for this message (RFC 3339), for ordering and UI clocks. |

`state` semantics:

- `running` — replay is active (may advance `seq` / `elapsedMs`).
- `paused` — replay is paused; `seq` / `elapsedMs` reflect the paused position.
- `done` — replay finished; typically the last message for this `replayId`.

### Examples

**Start** — first frame after the client connects (replay has begun, at the beginning):

```json
{
  "replayId": "replay_7f3c2a1b",
  "sessionId": "session_842f78fd-627e-4065-a7a9-5c83126c35dc",
  "seq": 0,
  "state": "running",
  "speed": 1,
  "elapsedMs": 0,
  "ts": "2026-03-24T12:00:00.000Z"
}
```

**Step** — progress update while replay is advancing:

```json
{
  "replayId": "replay_7f3c2a1b",
  "sessionId": "session_842f78fd-627e-4065-a7a9-5c83126c35dc",
  "seq": 12,
  "state": "running",
  "speed": 2,
  "elapsedMs": 8450,
  "ts": "2026-03-24T12:00:08.450Z"
}
```

**Done** — replay completed (terminal message for this stream):

```json
{
  "replayId": "replay_7f3c2a1b",
  "sessionId": "session_842f78fd-627e-4065-a7a9-5c83126c35dc",
  "seq": 42,
  "state": "done",
  "speed": 1,
  "elapsedMs": 31020,
  "ts": "2026-03-24T12:00:31.020Z"
}
```

This contract is the shared source of truth for the UI and backend implementations of replay streaming.
