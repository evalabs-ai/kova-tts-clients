# Kova TTS Clients

This repo should contain official client libraries for the Kova TTS API:

- npm package for JavaScript/TypeScript
- pip package for Python

Use a single monorepo so both clients share one API contract, examples, fixtures, and release checklist.

## Install From GitHub

Both package managers can install directly from the root of this repository.
Replace `evalabs-ai/kova-tts-clients` with the actual GitHub repo path.

Python:

```sh
pip install git+https://github.com/evalabs-ai/kova-tts-clients.git
```

JavaScript:

```sh
npm install git+https://github.com/evalabs-ai/kova-tts-clients.git
```

The root `pyproject.toml` packages the Python client from
`packages/python/src/kova_tts`. The root `package.json` builds and exposes the
TypeScript client from `packages/js`.

## Example Usage

The clients default to `https://api.evalabs.ai/v1/tts`, so typical usage only
requires an API key. You can still override the endpoint for staging or local
servers by passing either the API origin (`https://api.evalabs.ai`) or the full
TTS endpoint (`https://api.evalabs.ai/v1/tts`) as `baseUrl` / `base_url`.

JavaScript:

```ts
import { KovaTTSClient } from "@kova/tts";

const client = new KovaTTSClient({
  apiKey: "YOUR_API_KEY",
});

const result = await client.tts({
  text: "Hello world.",
  voice: "leon",
  response_format: "mp3",
  timestamps: true,
});

await client.writeAudioFile(result.audio, "out.mp3");
console.log(result.timestamps?.words);
```

Python:

```py
from kova_tts import KovaTTSClient

client = KovaTTSClient(
    api_key="YOUR_API_KEY",
)

result = client.tts(
    text="Hello world.",
    voice="leon",
    response_format="mp3",
    timestamps=True,
)

client.write_audio_file(result.audio, "out.mp3")
print(result.timestamps.words if result.timestamps else None)
```

Client responses decode audio before returning it. Sync `result.audio` is the
decoded audio file bytes. Streaming and WebSocket audio frames expose `audio` as
decoded PCM bytes.

Direct curl smoke test:

```sh
curl -X POST https://api.evalabs.ai/v1/tts \
  -H 'x-api-key: YOUR_API_KEY' \
  -H 'content-type: application/json' \
  -d '{"text":"Hello world.","voice":"leon","response_format":"mp3","timestamps":true}'
```

## API Contract

Public API routes are exposed behind ingress under `/v1/tts`.

- `POST /v1/tts` - sync TTS
- `POST /v1/tts/stream` - HTTP streaming TTS
- `WS /v1/tts/ws` - WebSocket streaming TTS

Authentication uses the `x-api-key` header.

### HTTP Request

Both HTTP endpoints accept the same JSON request body:

```ts
type TTSRequest = {
  text: string;
  voice: string;
  temperature?: number | null;
  response_format?: "mp3" | "wav" | "m4a";
  timestamps?: boolean;
};
```

Defaults:

- `temperature`: omitted means server internal default
- `response_format`: `"mp3"`
- `timestamps`: `false`

The old `sampling_params` field is not part of the public HTTP API. Clients should not expose `top_p`, `top_k`, or `repetition_penalty`.

### Sync TTS

Request:

```http
POST /v1/tts
x-api-key: <api key>
content-type: application/json
```

Response:

```ts
type SyncTTSResponse = {
  audio: string;
  timestamps?: {
    words: string[];
    start_seconds: number[];
    end_seconds: number[];
  };
};
```

`audio` is a base64 encoded audio file. The file format follows `response_format`.

### HTTP Streaming TTS

Request:

```http
POST /v1/tts/stream
x-api-key: <api key>
content-type: application/json
```

Response is `text/plain` with SSE-style records:

```text
data: {"type":"audio","audio_chunk":"<base64 pcm>"}

data: {"type":"timestamps","words":["hello"],"start_seconds":[0.0],"end_seconds":[0.3]}
```

Event types:

```ts
type StreamAudioEvent = {
  type: "audio";
  audio_chunk: string;
};

type StreamTimestampsEvent = {
  type: "timestamps";
  words: string[];
  start_seconds: number[];
  end_seconds: number[];
};

type StreamEvent = StreamAudioEvent | StreamTimestampsEvent;
```

`audio_chunk` is base64 little-endian int16 PCM at 32 kHz mono. Timestamp events are only emitted when `timestamps: true`.

### WebSocket TTS

Connect to:

```text
wss://<host>/v1/tts/ws
```

Pass `x-api-key` during the WebSocket handshake if the runtime supports custom headers. Browser clients cannot reliably set custom WebSocket headers; the JS client should document this and optionally support an API-key query parameter only if the server later supports it.

The WebSocket protocol supports multiple independent contexts on one connection. Frames are JSON objects with discriminator fields.

Client-to-server frames:

```ts
type ContextConfig = {
  voice_id: string;
  model_id: string;
  temperature?: number | null;
  timestamps?: boolean;
};

type StartContext = {
  start_context: ContextConfig;
  context_id?: string | null;
};

type SendText = {
  send_text: string;
  context_id?: string | null;
};

type Flush = {
  flush: true;
  context_id?: string | null;
  flush_id?: string | null;
};

type CloseContext = {
  close_context: true;
  context_id?: string | null;
  flush_id?: string | null;
};
```

Server-to-client frames:

```ts
type ContextStarted = {
  context_started: ContextConfig;
  context_id?: string | null;
};

type AudioChunk = {
  audio_chunk: string;
  context_id?: string | null;
  chunk_id?: string | null;
};

type Timestamps = {
  timestamps: {
    words: string[];
    start_seconds: number[];
    end_seconds: number[];
  };
  context_id?: string | null;
  chunk_id?: string | null;
};

type FlushCompleted = {
  flush_completed: true;
  flush_id: string;
  context_id?: string | null;
  chunk_id?: string | null;
};

type ContextClosed = {
  context_closed: true;
  context_id?: string | null;
};

type ErrorFrame = {
  error: string;
  context_id?: string | null;
  flush_id?: string | null;
  chunk_id?: string | null;
};
```

WebSocket `audio_chunk` values are base64 little-endian int16 PCM at 32 kHz mono. Timestamp frames are only emitted for contexts started with `timestamps: true`.

WS sampling behavior:

- Client can set `temperature` in `start_context`.
- `top_p`, `top_k`, and `repetition_penalty` are fixed server defaults and should not be exposed by clients.

## Recommended Repo Layout

```text
kova-tts-clients/
  README.md
  package.json                 # optional workspace root for npm tooling
  pyproject.toml               # optional workspace/tooling root, not the published Python package
  protocol/
    api-contract.md
    fixtures/
      sync_response.json
      stream_audio_event.json
      stream_timestamps_event.json
      ws_frames.json
  packages/
    js/
      package.json
      tsconfig.json
      src/
        index.ts
        client.ts
        types.ts
        stream.ts
        websocket.ts
      test/
      README.md
    python/
      pyproject.toml
      src/
        kova_tts/
          __init__.py
          client.py
          types.py
          stream.py
          websocket.py
      tests/
      README.md
  examples/
    js/
      sync.ts
      stream.ts
      websocket.ts
    python/
      sync.py
      stream.py
      websocket.py
```

## JavaScript Client Goals

Package names to consider:

- npm package: `@kova/tts` if scoped publishing is available
- fallback npm package: `kova-tts`

Primary API:

```ts
import { KovaTTSClient } from "@kova/tts";

const client = new KovaTTSClient({
  apiKey: process.env.KOVA_API_KEY!,
});

const result = await client.tts({
  text: "Hello world.",
  voice: "leon",
  response_format: "mp3",
  timestamps: true,
});

await client.writeAudioFile(result.audio, "out.mp3");
```

Streaming API:

```ts
for await (const event of client.streamTTS({
  text: "Hello world.",
  voice: "leon",
  timestamps: true,
})) {
  if (event.type === "audio") {
    const pcmBytes = event.audio;
  }
}
```

WebSocket API:

```ts
const ws = await client.connectWebSocket();

await ws.startContext({
  contextId: "ctx-1",
  voiceId: "leon",
  modelId: "default",
  timestamps: true,
});

await ws.sendText("ctx-1", "Hello ");
await ws.sendText("ctx-1", "world.");
await ws.flush("ctx-1");

for await (const frame of ws) {
  // frame is one of the server-to-client frame types.
}
```

Implementation notes:

- Use TypeScript.
- Support Node 18+.
- Use global `fetch` for HTTP.
- For Node WebSocket support, use `ws` or another maintained dependency.
- Browser WebSocket support needs an auth story; custom headers are not available in browser `WebSocket`.
- Provide helpers:
  - `decodeBase64ToBytes`
  - `decodePcm16LeBase64`
  - `writeAudioFile` for sync output in Node
- Validate known event/frame shapes enough to produce useful client errors.

## Python Client Goals

Package names:

- pip distribution: `kova-tts`
- import package: `kova_tts`

Primary API:

```py
from kova_tts import KovaTTSClient

client = KovaTTSClient(
    api_key="...",
)

result = client.tts(
    text="Hello world.",
    voice="leon",
    response_format="mp3",
    timestamps=True,
)

client.write_audio_file(result.audio, "out.mp3")
```

Async streaming API:

```py
async for event in client.stream_tts(
    text="Hello world.",
    voice="leon",
    timestamps=True,
):
    if event.type == "audio":
        pcm_bytes = event.audio
```

WebSocket API:

```py
async with client.websocket() as ws:
    await ws.start_context(
        context_id="ctx-1",
        voice_id="leon",
        model_id="default",
        timestamps=True,
    )
    await ws.send_text("Hello ", context_id="ctx-1")
    await ws.send_text("world.", context_id="ctx-1")
    await ws.flush(context_id="ctx-1")

    async for frame in ws:
        ...
```

Implementation notes:

- Use `httpx` for sync and async HTTP.
- Use `websockets` for async WebSocket.
- Use typed dataclasses or Pydantic models. Prefer lightweight dataclasses unless validation needs become substantial.
- Provide helpers:
  - `decode_base64_bytes`
  - `decode_pcm16le_base64`
  - `write_audio_file`
- Keep `temperature` as the only sampling option.

## Error Handling

Both clients should normalize errors into package-specific exceptions:

- `KovaTTSAuthError` for 401/403
- `KovaTTSRateLimitError` for 429
- `KovaTTSServerError` for 5xx
- `KovaTTSValidationError` for 400/422
- `KovaTTSConnectionError` for network/WebSocket failures

For WebSocket `ErrorFrame`, raise or emit a typed error depending on API style. Do not silently drop it.

## Tests

Minimum test coverage:

- HTTP request serialization:
  - includes `text`, `voice`, optional `temperature`, `response_format`, `timestamps`
  - does not include `sampling_params`
- Sync response parsing with and without timestamps
- Stream parser:
  - parses multiple `data:` records
  - ignores blank separator lines
  - handles audio and timestamp events
- WebSocket frame serialization:
  - `start_context`
  - `send_text`
  - `flush`
  - `close_context`
- WebSocket frame parsing:
  - `context_started`
  - `audio_chunk`
  - `timestamps`
  - `flush_completed`
  - `context_closed`
  - `error`
- Base64 helper round trips
- Examples typecheck/run against mocked transport

Add optional integration tests that run only when these env vars are present:

- `KOVA_API_KEY`
- `KOVA_TEST_VOICE`

`KOVA_BASE_URL` can be supported as an optional override for non-default
environments.

## Publishing

JavaScript:

- Build with `tsup` or `tsc`.
- Publish ESM and CJS if easy; otherwise ESM-only is acceptable for Node 18+.
- Include generated `.d.ts`.
- Use semantic versioning.

Python:

- Build with `hatchling` or `uv`.
- Support Python 3.10+.
- Publish wheels and sdist.
- Use semantic versioning.

Release process:

1. Update shared protocol docs/fixtures.
2. Update JS and Python clients.
3. Run unit tests for both packages.
4. Run optional integration tests against staging.
5. Publish both packages with the same version when API behavior changes.

## Current Server Assumptions

- Sync route returns base64 encoded file audio.
- HTTP stream and WebSocket audio chunks are base64 int16 PCM, 32 kHz mono.
- Timestamp format is parallel arrays: `words`, `start_seconds`, `end_seconds`.
- HTTP stream has no final done event.
- HTTP stream event objects include `type`.
- WebSocket frame objects do not include a `type` field; discriminator is the presence of fields like `audio_chunk`, `timestamps`, or `context_closed`.
- `chunk_id` may be present on WS server frames.
- `context_id` may be omitted/null for the default context.
