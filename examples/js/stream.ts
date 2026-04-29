import { KovaTTSClient } from "@kova/tts";

const client = new KovaTTSClient({
  apiKey: process.env.KOVA_API_KEY!,
});

for await (const event of client.streamTTS({
  text: "Hello world.",
  voice: process.env.KOVA_TEST_VOICE ?? "leon",
  timestamps: true,
})) {
  if (event.type === "audio") {
    const pcm = client.decodePcmChunk(event.audio_chunk);
    console.log(`received ${pcm.length} PCM samples`);
  } else {
    console.log(event.words.join(" "));
  }
}
