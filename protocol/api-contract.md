# Kova TTS API Contract

Public API routes are exposed under `/v1/tts`.

- `POST /v1/tts` - synchronous text to speech
- `POST /v1/tts/stream` - HTTP streaming text to speech
- `WS /v1/tts/ws` - WebSocket streaming text to speech

Authentication uses the `x-api-key` header.

## HTTP Request

Both HTTP endpoints accept:

```ts
type TTSRequest = {
  text: string;
  voice: string;
  temperature?: number | null;
  response_format?: {
    encoding: "mp3" | "pcm" | "wav" | "linear16" | "opus" | "mulaw" | "alaw";
    sample_rate?: number | null;
    bitrate?: string | number | null;
  };
  timestamps?: boolean;
  normalize_text?: boolean;
};
```

Clients must not expose `sampling_params`, `top_p`, `top_k`, or
`repetition_penalty`.

## Sync Response

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

## HTTP Stream Events

Responses are `text/plain` with SSE-style `data:` records.

```ts
type StreamEvent =
  | { type: "audio"; audio_chunk: string }
  | {
      type: "timestamps";
      words: string[];
      start_seconds: number[];
      end_seconds: number[];
    };
```

`audio_chunk` is base64 encoded audio bytes. The audio format follows
`response_format`.

## WebSocket Frames

Client frames are discriminated by fields such as `start_context`,
`send_text`, `flush`, and `close_context`. Server frames are discriminated by
fields such as `context_started`, `audio_chunk`, `timestamps`,
`flush_completed`, `context_closed`, and `error`.

`start_context` accepts the same `response_format` object as HTTP requests.
The server may echo that object in `context_started`.

WebSocket audio chunks are base64 little-endian int16 PCM at 32 kHz mono.
