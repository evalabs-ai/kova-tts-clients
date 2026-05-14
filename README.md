# Kova TTS Clients

Official JavaScript/TypeScript and Python clients for the Kova TTS API.

## Install

JavaScript / TypeScript:

```sh
npm install @kova-ai/tts
```

Python:

```sh
pip install kova-tts
```

## JavaScript / TypeScript

```ts
import { KovaTTSClient } from "@kova-ai/tts";

const client = new KovaTTSClient({
  apiKey: process.env.KOVA_API_KEY!,
});
```

### Sync

```ts
const result = await client.tts({
  text: "Hello world.",
  voice: "cal",
  response_format: { encoding: "mp3" },
  timestamps: true,
  normalize_text: true,
});

await client.writeAudioFile(result.audio, "out.mp3");
console.log(result.timestamps?.words);
```

### Streaming

```ts
for await (const event of client.streamTTS({
  text: "Hello world.",
  voice: "cal",
  response_format: { encoding: "pcm", sample_rate: 32000 }, //pcm, wav or linear16 @32khz recommended for lowest latency
  timestamps: true,
  normalize_text: true,
})) {
  switch (event.type) {
    case "audio":
      console.log(`received ${event.audio.byteLength} audio bytes`);
      break;
    case "timestamps":
      console.log(event.words);
      break;
  }
}
```

### WebSocket

```ts
const ws = await client.connectWebSocket();
const sampleRate = 32000;
const pcmChunks: Uint8Array[] = [];

await ws.startContext({
  contextId: "ctx-1",
  voiceId: "cal",
  modelId: "default",
  timestamps: true,
  responseFormat: { encoding: "pcm", sample_rate: sampleRate },
});

await ws.sendText("ctx-1", "Hello ");
await ws.sendText("ctx-1", "world.");
await ws.flush("ctx-1");

for await (const frame of ws) {
  switch (frame.type) {
    case "audio":
      pcmChunks.push(frame.audio);
      break;
    case "timestamps":
      console.log(frame.timestamps.words);
      break;
    case "flush_completed":
      ws.close();
      break;
  }
}

await client.writePcm16WavFile(concatBytes(pcmChunks), "out.wav", { sampleRate });

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}
```

## Python

```py
from kova_tts import KovaTTSClient

client = KovaTTSClient(
    api_key="YOUR_API_KEY",
)
```

### Sync

```py
from kova_tts import AudioResponseFormat

result = client.tts(
    text="Hello world.",
    voice="cal",
    response_format=AudioResponseFormat(encoding="mp3"),
    timestamps=True,
    normalize_text=True,
)

client.write_audio_file(result.audio, "out.mp3")
print(result.timestamps.words if result.timestamps else None)
```

### Streaming

```py
async for event in client.stream_tts(
    text="Hello world.",
    voice="cal",
    response_format=AudioResponseFormat(encoding="mp3"),
    timestamps=True,
    normalize_text=True,
):
    if event.type == "audio":
        print(f"received {len(event.audio)} audio bytes")
    elif event.type == "timestamps":
        print(event.words)
```

### WebSocket

```py
from kova_tts import AudioResponseFormat

async with client.websocket() as ws:
    await ws.start_context(
        context_id="ctx-1",
        voice_id="cal",
        model_id="default",
        timestamps=True,
        response_format=AudioResponseFormat(encoding="pcm", sample_rate=32000),
    )

    await ws.send_text("Hello ", context_id="ctx-1")
    await ws.send_text("world.", context_id="ctx-1")
    await ws.flush(context_id="ctx-1")

    async for frame in ws:
        match frame.type:
            case "audio":
                print(f"received {len(frame.audio)} audio bytes")
            case "timestamps":
                print(frame.timestamps.words)
            case "flush_completed":
                break
```

## Response Formats

`response_format` supports these encodings:

```text
mp3, pcm, wav, linear16, opus, mulaw, alaw
```

Optional fields:

```ts
{
  encoding: "mp3",
  sample_rate: 32000,
  bitrate: "128k"
}
```
