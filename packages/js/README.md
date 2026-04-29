# @kova/tts

TypeScript client for the Kova TTS API.

Install directly from GitHub before npm publishing:

```sh
npm install git+https://github.com/OWNER/kova-tts-clients.git
```

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
```

`result.audio` is decoded file bytes as a `Uint8Array`. Streaming and
WebSocket audio events expose decoded PCM bytes on `event.audio` / `frame.audio`.

The default endpoint is `https://api.evalabs.ai/v1/tts`. Override `baseUrl` only
for staging or local servers.

Browser WebSocket connections cannot reliably send custom headers. The
WebSocket helper is intended for Node runtimes where the `x-api-key` handshake
header can be set.
