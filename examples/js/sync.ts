import { KovaTTSClient } from "@kova/tts";

const client = new KovaTTSClient({
  apiKey: process.env.KOVA_API_KEY!,
});

const result = await client.tts({
  text: "Hello world.",
  voice: process.env.KOVA_TEST_VOICE ?? "leon",
  response_format: "mp3",
  timestamps: true,
});

await client.writeAudioFile(result.audio, "out.mp3");
