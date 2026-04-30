import assert from "node:assert/strict";
import test from "node:test";

import {
  decodeBase64ToBytes,
  decodePcm16LeBase64,
  KovaTTSClient,
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
    voice: "leon",
    temperature: 0.7,
    response_format: "mp3",
    timestamps: true,
    normalize_text: true,
  });

  assert.deepEqual(payload, {
    text: "Hello",
    voice: "leon",
    temperature: 0.7,
    response_format: "mp3",
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

  await client.tts({ text: "Hello", voice: "leon" });

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

test("serializes websocket client frames", () => {
  assert.deepEqual(
    serializeStartContext({
      contextId: "ctx-1",
      voiceId: "leon",
      modelId: "default",
      timestamps: true,
    }),
    {
      start_context: {
        voice_id: "leon",
        model_id: "default",
        timestamps: true,
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
    "context_started" in
      parseWebSocketFrame({
        context_started: { voice_id: "leon", model_id: "default" },
        context_id: "ctx-1",
      }),
    true,
  );
  const audio = parseWebSocketFrame({ audio_chunk: "AAE=" });
  assert.equal("audio" in audio, true);
  assert.deepEqual([...audio.audio], [0, 1]);
  assert.equal("audio_chunk" in audio, false);
  assert.equal(
    "timestamps" in
      parseWebSocketFrame({
        timestamps: { words: ["hello"], start_seconds: [0], end_seconds: [0.3] },
      }),
    true,
  );
  assert.equal(
    "flush_completed" in parseWebSocketFrame({ flush_completed: true, flush_id: "flush-1" }),
    true,
  );
  assert.equal("context_closed" in parseWebSocketFrame({ context_closed: true }), true);
  assert.equal("error" in parseWebSocketFrame({ error: "bad request" }), true);
});
