import WebSocket from "ws";
import { decodeBase64ToBytes } from "./audio.js";
import { KovaTTSConnectionError, KovaTTSProtocolError } from "./errors.js";
import type {
  ClientWebSocketFrame,
  ContextConfig,
  ServerWebSocketFrame,
} from "./types.js";

export type StartContextOptions = {
  contextId?: string | null;
  voiceId: string;
  modelId: string;
  temperature?: number | null;
  timestamps?: boolean;
};

export function serializeStartContext(options: StartContextOptions): ClientWebSocketFrame {
  return withOptionalContext(
    {
      start_context: {
        voice_id: options.voiceId,
        model_id: options.modelId,
        ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
        ...(options.timestamps !== undefined ? { timestamps: options.timestamps } : {}),
      },
    },
    options.contextId,
  );
}

export function serializeSendText(text: string, contextId?: string | null): ClientWebSocketFrame {
  return withOptionalContext({ send_text: text }, contextId);
}

export function serializeFlush(
  contextId?: string | null,
  flushId?: string | null,
): ClientWebSocketFrame {
  return {
    flush: true,
    ...(contextId !== undefined ? { context_id: contextId } : {}),
    ...(flushId !== undefined ? { flush_id: flushId } : {}),
  };
}

export function serializeCloseContext(
  contextId?: string | null,
  flushId?: string | null,
): ClientWebSocketFrame {
  return {
    close_context: true,
    ...(contextId !== undefined ? { context_id: contextId } : {}),
    ...(flushId !== undefined ? { flush_id: flushId } : {}),
  };
}

export function parseWebSocketFrame(value: unknown): ServerWebSocketFrame {
  if (!value || typeof value !== "object") {
    throw new KovaTTSProtocolError("WebSocket frame must be an object");
  }

  const frame = value as Record<string, unknown>;
  if (typeof frame.error === "string") {
    return frame as ServerWebSocketFrame;
  }
  if (isContextConfig(frame.context_started)) {
    return frame as ServerWebSocketFrame;
  }
  if (typeof frame.audio_chunk === "string") {
    return {
      audio: decodeBase64ToBytes(frame.audio_chunk),
      ...(frame.context_id !== undefined ? { context_id: frame.context_id } : {}),
      ...(frame.chunk_id !== undefined ? { chunk_id: frame.chunk_id } : {}),
    } as ServerWebSocketFrame;
  }
  if (frame.timestamps && typeof frame.timestamps === "object") {
    return frame as ServerWebSocketFrame;
  }
  if (frame.flush_completed === true && typeof frame.flush_id === "string") {
    return frame as ServerWebSocketFrame;
  }
  if (frame.context_closed === true) {
    return frame as ServerWebSocketFrame;
  }

  throw new KovaTTSProtocolError(`Unknown WebSocket frame shape: ${JSON.stringify(value)}`);
}

export class KovaTTSWebSocket implements AsyncIterable<ServerWebSocketFrame> {
  private readonly queue: ServerWebSocketFrame[] = [];
  private readonly waiters: Array<{
    resolve: (result: IteratorResult<ServerWebSocketFrame>) => void;
    reject: (error: Error) => void;
  }> = [];
  private closed = false;
  private closeError: Error | null = null;

  private constructor(private readonly socket: WebSocket) {
    socket.on("message", (data) => this.handleMessage(data));
    socket.on("error", (error) => this.handleError(error));
    socket.on("close", () => this.handleClose());
  }

  static connect(url: string, apiKey: string): Promise<KovaTTSWebSocket> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url, { headers: { "x-api-key": apiKey } });
      const fail = (error: Error) => reject(new KovaTTSConnectionError(error.message));
      socket.once("open", () => {
        socket.off("error", fail);
        resolve(new KovaTTSWebSocket(socket));
      });
      socket.once("error", fail);
    });
  }

  async startContext(options: StartContextOptions): Promise<void> {
    this.sendFrame(serializeStartContext(options));
  }

  async sendText(contextId: string | null | undefined, text: string): Promise<void> {
    this.sendFrame(serializeSendText(text, contextId));
  }

  async flush(contextId?: string | null, flushId?: string | null): Promise<void> {
    this.sendFrame(serializeFlush(contextId, flushId));
  }

  async closeContext(contextId?: string | null, flushId?: string | null): Promise<void> {
    this.sendFrame(serializeCloseContext(contextId, flushId));
  }

  close(): void {
    this.socket.close();
  }

  [Symbol.asyncIterator](): AsyncIterator<ServerWebSocketFrame> {
    return {
      next: () => this.nextFrame(),
    };
  }

  private sendFrame(frame: ClientWebSocketFrame): void {
    if (this.socket.readyState !== WebSocket.OPEN) {
      throw new KovaTTSConnectionError("WebSocket is not open");
    }
    this.socket.send(JSON.stringify(frame));
  }

  private nextFrame(): Promise<IteratorResult<ServerWebSocketFrame>> {
    if (this.queue.length > 0) {
      return Promise.resolve({ done: false, value: this.queue.shift()! });
    }
    if (this.closeError) {
      return Promise.reject(this.closeError);
    }
    if (this.closed) {
      return Promise.resolve({ done: true, value: undefined });
    }
    return new Promise((resolve, reject) => this.waiters.push({ resolve, reject }));
  }

  private handleMessage(data: WebSocket.RawData): void {
    try {
      const raw = typeof data === "string" ? data : data.toString("utf8");
      const frame = parseWebSocketFrame(JSON.parse(raw));
      if ("error" in frame) {
        throw new KovaTTSProtocolError(frame.error);
      }
      const waiter = this.waiters.shift();
      if (waiter) {
        waiter.resolve({ done: false, value: frame });
      } else {
        this.queue.push(frame);
      }
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private handleError(error: Error): void {
    this.closeError = error instanceof KovaTTSProtocolError
      ? error
      : new KovaTTSConnectionError(error.message);
    while (this.waiters.length > 0) {
      this.waiters.shift()!.reject(this.closeError);
    }
  }

  private handleClose(): void {
    this.closed = true;
    while (this.waiters.length > 0 && !this.closeError) {
      this.waiters.shift()!.resolve({ done: true, value: undefined });
    }
  }
}

function withOptionalContext<T extends object>(frame: T, contextId?: string | null): T & {
  context_id?: string | null;
} {
  return {
    ...frame,
    ...(contextId !== undefined ? { context_id: contextId } : {}),
  };
}

function isContextConfig(value: unknown): value is ContextConfig {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as ContextConfig).voice_id === "string" &&
    typeof (value as ContextConfig).model_id === "string"
  );
}
