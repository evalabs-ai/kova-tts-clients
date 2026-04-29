import { KovaTTSClient } from "@kova/tts";

const client = new KovaTTSClient({
  apiKey: process.env.KOVA_API_KEY!,
});

const ws = await client.connectWebSocket();

await ws.startContext({
  contextId: "ctx-1",
  voiceId: process.env.KOVA_TEST_VOICE ?? "leon",
  modelId: "default",
  timestamps: true,
});
await ws.sendText("ctx-1", "Hello ");
await ws.sendText("ctx-1", "world.");
await ws.flush("ctx-1");

for await (const frame of ws) {
  console.log(frame);
}
