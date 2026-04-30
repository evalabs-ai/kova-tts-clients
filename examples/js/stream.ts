import { KovaTTSClient } from "@kova/tts";

const client = new KovaTTSClient({
  apiKey: process.env.KOVA_API_KEY!,
});

for await (const event of client.streamTTS({
  text: "Hello world.",
  voice: process.env.KOVA_TEST_VOICE ?? "leon",
  timestamps: true,
  normalize_text: true,
})) {
  if (event.type === "audio") {
    console.log(`received ${event.audio.byteLength} PCM bytes`);
  } else {
    console.log(event.words.join(" "));
  }
}
