import "dotenv/config";

import { KovaTTSClient } from "@kova-ai/tts";

const client = new KovaTTSClient({
  apiKey: process.env.KOVA_API_KEY!,
  baseUrl: process.env.KOVA_BASE_URL,
});

const ws = await client.connectWebSocket();
const sampleRate = 32000;
const wavOptions = { sampleRate, channels: 1 };

await ws.startContext({
  contextId: "ctx-1",
  voiceId: "cal",
  modelId: "default",
  timestamps: true,
  responseFormat: { encoding: "pcm", sample_rate: sampleRate },
});
await ws.sendText("ctx-1", "Hello ");
await ws.startContext({
  contextId: "ctx-2",
  voiceId: "ash",
  modelId: "default",
  timestamps: true,
  responseFormat: { encoding: "pcm", sample_rate: sampleRate },
});
await ws.sendText("ctx-1", "world.");
await ws.sendText("ctx-2", "This is ");
await ws.flush("ctx-1");
await ws.sendText("ctx-2", "a test.");
await ws.flush("ctx-2");

const chunksByContext = new Map<string, Uint8Array[]>();
const completedContexts = new Set<string>();

for await (const frame of ws) {
  switch (frame.type) {
    case "context_started":
      console.log("context started", frame.context_started);
      break;
    case "audio":
      console.log(`received ${frame.audio.byteLength} audio bytes`);
      if (frame.context_id) {
        const chunks = chunksByContext.get(frame.context_id) ?? [];
        chunks.push(frame.audio);
        chunksByContext.set(frame.context_id, chunks);
      }
      break;
    case "timestamps":
      console.log(frame.timestamps.words.join(" "));
      break;
    case "flush_completed":
      console.log("flush completed", frame.flush_id);
      if (frame.context_id) {
        completedContexts.add(frame.context_id);
      }
      if (completedContexts.has("ctx-1") && completedContexts.has("ctx-2")) {
        ws.close();
      }
      break;
    case "context_closed":
      console.log("context closed", frame.context_id);
      break;
    case "error":
      throw new Error(frame.error);
  }
}

await client.writePcm16WavFile(
  concatBytes(chunksByContext.get("ctx-1") ?? []),
  "context1.wav",
  wavOptions,
);
await client.writePcm16WavFile(
  concatBytes(chunksByContext.get("ctx-2") ?? []),
  "context2.wav",
  wavOptions,
);

console.log("wrote context1.wav and context2.wav");

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const byteLength = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const output = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}
