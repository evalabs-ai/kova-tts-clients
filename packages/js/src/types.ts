export type AudioEncoding =
  | "mp3"
  | "pcm"
  | "wav"
  | "linear16"
  | "opus"
  | "mulaw"
  | "alaw";

export type AudioResponseFormat = {
  encoding: AudioEncoding;
  sample_rate?: number | null;
  bitrate?: string | number | null;
};

export type ResponseFormat = AudioResponseFormat;

export type TTSRequest = {
  text: string;
  voice: string;
  temperature?: number | null;
  response_format?: ResponseFormat;
  timestamps?: boolean;
  normalize_text?: boolean;
};

export type TTSTimestamps = {
  words: string[];
  start_seconds: number[];
  end_seconds: number[];
};

export type SyncTTSResponse = {
  /** Decoded audio file bytes. Format follows the request response_format. */
  audio: Uint8Array;
  timestamps?: TTSTimestamps;
};

export type StreamAudioEvent = {
  type: "audio";
  /** Decoded audio bytes. Format follows the request response_format. */
  audio: Uint8Array;
};

export type StreamTimestampsEvent = TTSTimestamps & {
  type: "timestamps";
};

export type StreamEvent = StreamAudioEvent | StreamTimestampsEvent;

export type ContextConfig = {
  voice_id: string;
  model_id: string;
  temperature?: number | null;
  timestamps?: boolean;
  response_format?: ResponseFormat;
};

export type StartContext = {
  start_context: ContextConfig;
  context_id?: string | null;
};

export type SendText = {
  send_text: string;
  context_id?: string | null;
};

export type Flush = {
  flush: true;
  context_id?: string | null;
  flush_id?: string | null;
};

export type CloseContext = {
  close_context: true;
  context_id?: string | null;
  flush_id?: string | null;
};

export type ClientWebSocketFrame = StartContext | SendText | Flush | CloseContext;

export type ContextStarted = {
  type: "context_started";
  context_started: ContextConfig;
  context_id?: string | null;
};

export type AudioChunk = {
  type: "audio";
  /** Decoded little-endian int16 PCM bytes at 32 kHz mono. */
  audio: Uint8Array;
  context_id?: string | null;
  chunk_id?: string | null;
};

export type Timestamps = {
  type: "timestamps";
  timestamps: TTSTimestamps;
  context_id?: string | null;
  chunk_id?: string | null;
};

export type FlushCompleted = {
  type: "flush_completed";
  flush_completed: true;
  flush_id: string;
  context_id?: string | null;
  chunk_id?: string | null;
};

export type ContextClosed = {
  type: "context_closed";
  context_closed: true;
  context_id?: string | null;
};

export type ErrorFrame = {
  type: "error";
  error: string;
  context_id?: string | null;
  flush_id?: string | null;
  chunk_id?: string | null;
};

export type ServerWebSocketFrame =
  | ContextStarted
  | AudioChunk
  | Timestamps
  | FlushCompleted
  | ContextClosed
  | ErrorFrame;
