export type ResponseFormat = "mp3" | "wav" | "m4a";

export type TTSRequest = {
  text: string;
  voice: string;
  temperature?: number | null;
  response_format?: ResponseFormat;
  timestamps?: boolean;
};

export type TTSTimestamps = {
  words: string[];
  start_seconds: number[];
  end_seconds: number[];
};

export type SyncTTSResponse = {
  audio: string;
  timestamps?: TTSTimestamps;
};

export type StreamAudioEvent = {
  type: "audio";
  audio_chunk: string;
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
  context_started: ContextConfig;
  context_id?: string | null;
};

export type AudioChunk = {
  audio_chunk: string;
  context_id?: string | null;
  chunk_id?: string | null;
};

export type Timestamps = {
  timestamps: TTSTimestamps;
  context_id?: string | null;
  chunk_id?: string | null;
};

export type FlushCompleted = {
  flush_completed: true;
  flush_id: string;
  context_id?: string | null;
  chunk_id?: string | null;
};

export type ContextClosed = {
  context_closed: true;
  context_id?: string | null;
};

export type ErrorFrame = {
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
