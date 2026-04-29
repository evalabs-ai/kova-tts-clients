import { KovaTTSProtocolError } from "./errors.js";
import { decodeBase64ToBytes } from "./audio.js";
import type { StreamEvent } from "./types.js";

export function parseStreamEvent(value: unknown): StreamEvent {
  if (!value || typeof value !== "object") {
    throw new KovaTTSProtocolError("Stream event must be an object");
  }

  const event = value as Record<string, unknown>;
  if (event.type === "audio" && typeof event.audio_chunk === "string") {
    return {
      type: "audio",
      audio: decodeBase64ToBytes(event.audio_chunk),
    };
  }

  if (
    event.type === "timestamps" &&
    Array.isArray(event.words) &&
    Array.isArray(event.start_seconds) &&
    Array.isArray(event.end_seconds)
  ) {
    return {
      type: "timestamps",
      words: event.words as string[],
      start_seconds: event.start_seconds as number[],
      end_seconds: event.end_seconds as number[],
    };
  }

  throw new KovaTTSProtocolError(`Unknown stream event shape: ${JSON.stringify(value)}`);
}

export async function* parseEventStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<StreamEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const records = buffer.split(/\r?\n\r?\n/);
      buffer = records.pop() ?? "";
      for (const record of records) {
        const event = parseSseRecord(record);
        if (event) {
          yield event;
        }
      }
    }

    buffer += decoder.decode();
    const finalEvent = parseSseRecord(buffer);
    if (finalEvent) {
      yield finalEvent;
    }
  } finally {
    reader.releaseLock();
  }
}

export function parseSseRecord(record: string): StreamEvent | null {
  const data = record
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!data) {
    return null;
  }

  return parseStreamEvent(JSON.parse(data));
}
