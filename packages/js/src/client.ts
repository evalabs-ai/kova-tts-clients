import {
  KovaTTSConnectionError,
  KovaTTSProtocolError,
  errorForStatus,
} from "./errors.js";
import { parseEventStream } from "./stream.js";
import type { StreamEvent, SyncTTSResponse, TTSRequest } from "./types.js";
import { KovaTTSWebSocket } from "./websocket.js";

export type KovaTTSClientOptions = {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof fetch;
};

export const DEFAULT_BASE_URL = "https://api.evalabs.ai/v1/tts";

export class KovaTTSClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: KovaTTSClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.fetchImpl = options.fetch ?? fetch;
  }

  async tts(request: TTSRequest): Promise<SyncTTSResponse> {
    const response = await this.postJson("/v1/tts", request);
    const json = await response.json();
    return parseSyncResponse(json);
  }

  async *streamTTS(request: TTSRequest): AsyncGenerator<StreamEvent> {
    const response = await this.postJson("/v1/tts/stream", request);
    if (!response.body) {
      throw new KovaTTSProtocolError("Streaming response did not include a body");
    }
    yield* parseEventStream(response.body);
  }

  connectWebSocket(): Promise<KovaTTSWebSocket> {
    const url = new URL("/v1/tts/ws", this.baseUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return KovaTTSWebSocket.connect(url.toString(), this.apiKey);
  }

  decodeBase64ToBytes(value: string): Uint8Array {
    return decodeBase64ToBytes(value);
  }

  decodePcmChunk(value: string): Int16Array {
    return decodePcm16LeBase64(value);
  }

  async writeAudioFile(audio: string, path: string): Promise<void> {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(path, decodeBase64ToBytes(audio));
  }

  private async postJson(path: string, request: TTSRequest): Promise<Response> {
    let response: Response;
    try {
      response = await this.fetchImpl(new URL(path, this.baseUrl), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.apiKey,
        },
        body: JSON.stringify(serializeTTSRequest(request)),
      });
    } catch (error) {
      throw new KovaTTSConnectionError(error instanceof Error ? error.message : String(error));
    }

    if (!response.ok) {
      throw await toResponseError(response);
    }
    return response;
  }
}

export function serializeTTSRequest(request: TTSRequest): Record<string, unknown> {
  return {
    text: request.text,
    voice: request.voice,
    ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    ...(request.response_format !== undefined ? { response_format: request.response_format } : {}),
    ...(request.timestamps !== undefined ? { timestamps: request.timestamps } : {}),
  };
}

export function parseSyncResponse(value: unknown): SyncTTSResponse {
  if (!value || typeof value !== "object") {
    throw new KovaTTSProtocolError("Sync TTS response must be an object");
  }
  const response = value as SyncTTSResponse;
  if (typeof response.audio !== "string") {
    throw new KovaTTSProtocolError("Sync TTS response is missing audio");
  }
  if (response.timestamps && !Array.isArray(response.timestamps.words)) {
    throw new KovaTTSProtocolError("Sync TTS response timestamps are invalid");
  }
  return response;
}

export function decodeBase64ToBytes(value: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(value, "base64"));
  }
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function decodePcm16LeBase64(value: string): Int16Array {
  const bytes = decodeBase64ToBytes(value);
  if (bytes.byteLength % 2 !== 0) {
    throw new KovaTTSProtocolError("PCM16 data must have an even byte length");
  }
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Int16Array(copy.buffer);
}

async function toResponseError(response: Response): Promise<Error> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = await response.text().catch(() => "");
  }
  return errorForStatus(response.status, `Kova TTS request failed with ${response.status}`, body);
}
