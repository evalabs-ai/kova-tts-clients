import "dotenv/config";

import { KovaTTSClient } from "@kova-ai/tts";

const client = new KovaTTSClient({
  apiKey: process.env.KOVA_API_KEY!,
});

for await (const event of client.streamTTS({
  text: "Hello world.",
  voice: process.env.KOVA_TEST_VOICE ?? "cal",
  timestamps: true,
  normalize_text: true,
  response_format: {
    encoding: "pcm"
  }
})) {
  if (event.type === "audio") {
    console.log(`received ${event.audio.byteLength} audio bytes`);
  } else {
    console.log(event.words.join(" "));
  }
}
