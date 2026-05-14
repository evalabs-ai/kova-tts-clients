import assert from "node:assert/strict";
import test from "node:test";

import {
  decodeBase64ToBytes,
  decodePcm16LeBase64,
  KovaTTSClient,
  isFlushCompleted,
  pcm16ToWavBytes,
  parseSseRecord,
  parseSyncResponse,
  parseWebSocketFrame,
  serializeCloseContext,
  serializeFlush,
  serializeSendText,
  serializeStartContext,
  serializeTTSRequest,
} from "../dist/index.js";

test("serializes HTTP requests without sampling params", () => {
  const payload = serializeTTSRequest({
    text: "Hello",
    voice: "cal",
    temperature: 0.7,
    response_format: {
      encoding: "opus",
      sample_rate: 48000,
      bitrate: "64k",
    },
    timestamps: true,
    normalize_text: true,
  });

  assert.deepEqual(payload, {
    text: "Hello",
    voice: "cal",
    temperature: 0.7,
    response_format: {
      encoding: "opus",
      sample_rate: 48000,
      bitrate: "64k",
    },
    timestamps: true,
    normalize_text: true,
  });
  assert.equal("sampling_params" in payload, false);
});

test("uses default base URL when none is provided", async () => {
  let requestedUrl;
  const client = new KovaTTSClient({
    apiKey: "dummy-api-key",
    fetch: async (url) => {
      requestedUrl = url.toString();
      return new Response(JSON.stringify({ audio: "AAE=" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  await client.tts({ text: "Hello", voice: "cal" });

  assert.equal(requestedUrl, "https://api.evalabs.ai/v1/tts");
});

test("parses sync responses", () => {
  const parsed = parseSyncResponse({
    audio: "AAE=",
    timestamps: {
      words: ["hello"],
      start_seconds: [0],
      end_seconds: [0.3],
    },
  });

  assert.deepEqual([...parsed.audio], [0, 1]);
  assert.equal("audioBytes" in parsed, false);
  assert.deepEqual(parsed.timestamps.words, ["hello"]);
});

test("parses SSE stream records", () => {
  const audio = parseSseRecord('data: {"type":"audio","audio_chunk":"AAE="}');
  assert.equal(audio.type, "audio");
  assert.deepEqual([...audio.audio], [0, 1]);
  assert.equal("audio_chunk" in audio, false);

  assert.deepEqual(
    parseSseRecord(
      'data: {"type":"timestamps","words":["hello"],"start_seconds":[0],"end_seconds":[0.3]}',
    ),
    {
      type: "timestamps",
      words: ["hello"],
      start_seconds: [0],
      end_seconds: [0.3],
    },
  );
});

test("base64 helpers round trip PCM16", () => {
  const data = Buffer.alloc(6);
  data.writeInt16LE(-1, 0);
  data.writeInt16LE(0, 2);
  data.writeInt16LE(42, 4);
  const encoded = data.toString("base64");

  assert.deepEqual([...decodeBase64ToBytes(encoded)], [...data]);
  assert.deepEqual([...decodePcm16LeBase64(encoded)], [-1, 0, 42]);
});

test("wraps PCM16 bytes in a WAV container", () => {
  const pcm = Uint8Array.from([0, 0, 255, 255]);
  const wav = pcm16ToWavBytes(pcm, { sampleRate: 32000 });
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);

  assert.equal(Buffer.from(wav.slice(0, 4)).toString("ascii"), "RIFF");
  assert.equal(view.getUint32(4, true), 40);
  assert.equal(Buffer.from(wav.slice(8, 12)).toString("ascii"), "WAVE");
  assert.equal(Buffer.from(wav.slice(12, 16)).toString("ascii"), "fmt ");
  assert.equal(view.getUint16(20, true), 1);
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint32(24, true), 32000);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal(Buffer.from(wav.slice(36, 40)).toString("ascii"), "data");
  assert.equal(view.getUint32(40, true), pcm.byteLength);
  assert.deepEqual([...wav.slice(44)], [...pcm]);
});

test("serializes websocket client frames", () => {
  assert.deepEqual(
    serializeStartContext({
      contextId: "ctx-1",
      voiceId: "cal",
      modelId: "default",
      timestamps: true,
      responseFormat: { encoding: "pcm", sample_rate: 32000 },
    }),
    {
      start_context: {
        voice_id: "cal",
        model_id: "default",
        timestamps: true,
        response_format: { encoding: "pcm", sample_rate: 32000 },
      },
      context_id: "ctx-1",
    },
  );
  assert.deepEqual(serializeSendText("Hello", "ctx-1"), {
    send_text: "Hello",
    context_id: "ctx-1",
  });
  assert.deepEqual(serializeFlush("ctx-1", "flush-1"), {
    flush: true,
    context_id: "ctx-1",
    flush_id: "flush-1",
  });
  assert.deepEqual(serializeCloseContext("ctx-1"), {
    close_context: true,
    context_id: "ctx-1",
  });
});

test("parses websocket server frames", () => {
  assert.equal(
    parseWebSocketFrame({
      context_started: { voice_id: "cal", model_id: "default" },
      context_id: "ctx-1",
    }).type,
    "context_started",
  );
  assert.deepEqual(
    parseWebSocketFrame({
      context_started: {
        voice_id: "cal",
        model_id: "default",
        response_format: { encoding: "pcm", sample_rate: 32000 },
      },
      context_id: "ctx-1",
    }).context_started.response_format,
    { encoding: "pcm", sample_rate: 32000 },
  );
  const audio = parseWebSocketFrame({ audio_chunk: "AAE=" });
  assert.equal(audio.type, "audio");
  assert.equal("audio" in audio, true);
  assert.deepEqual([...audio.audio], [0, 1]);
  assert.equal("audio_chunk" in audio, false);
  assert.equal(
    parseWebSocketFrame({
      timestamps: { words: ["hello"], start_seconds: [0], end_seconds: [0.3] },
    }).type,
    "timestamps",
  );
  const flushCompleted = parseWebSocketFrame({
    flush_completed: true,
    flush_id: "flush-1",
    context_id: "ctx-1",
    chunk_id: "ctx-1:chunk:0",
  });
  assert.equal(flushCompleted.type, "flush_completed");
  assert.equal("flush_completed" in flushCompleted, true);
  assert.equal(isFlushCompleted(flushCompleted), true);
  if (isFlushCompleted(flushCompleted)) {
    assert.equal(flushCompleted.flush_completed, true);
    assert.equal(flushCompleted.flush_id, "flush-1");
    assert.equal(flushCompleted.context_id, "ctx-1");
    assert.equal(flushCompleted.chunk_id, "ctx-1:chunk:0");
  }
  assert.equal(parseWebSocketFrame({ context_closed: true }).type, "context_closed");
  assert.equal(parseWebSocketFrame({ error: "bad request" }).type, "error");
});
