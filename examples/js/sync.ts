import "dotenv/config";

import { KovaTTSClient } from "@kova-ai/tts";

const client = new KovaTTSClient({
  apiKey: process.env.KOVA_API_KEY!,
});

const result = await client.tts({
  text: "Hello world.",
  voice: process.env.KOVA_TEST_VOICE ?? "cal",
  response_format: { encoding: "mp3" },
  timestamps: true,
  normalize_text: true,
});

await client.writeAudioFile(result.audio, "out.mp3");
