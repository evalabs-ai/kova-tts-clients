from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, TypeAlias

AudioEncoding: TypeAlias = Literal[
    "mp3",
    "pcm",
    "wav",
    "linear16",
    "opus",
    "mulaw",
    "alaw",
]


@dataclass(slots=True)
class AudioResponseFormat:
    encoding: AudioEncoding = "mp3"
    sample_rate: int | None = None
    bitrate: str | int | None = None


ResponseFormat: TypeAlias = AudioResponseFormat


@dataclass(slots=True)
class TTSRequest:
    text: str
    voice: str
    temperature: float | None = None
    response_format: ResponseFormat | None = None
    timestamps: bool | None = None
    normalize_text: bool | None = None


@dataclass(slots=True)
class TTSTimestamps:
    words: list[str]
    start_seconds: list[float]
    end_seconds: list[float]


@dataclass(slots=True)
class SyncTTSResponse:
    audio: bytes
    timestamps: TTSTimestamps | None = None


@dataclass(slots=True)
class StreamAudioEvent:
    type: Literal["audio"]
    audio: bytes


@dataclass(slots=True)
class StreamTimestampsEvent:
    type: Literal["timestamps"]
    words: list[str]
    start_seconds: list[float]
    end_seconds: list[float]


StreamEvent: TypeAlias = StreamAudioEvent | StreamTimestampsEvent


@dataclass(slots=True)
class ContextConfig:
    voice_id: str
    model_id: str
    temperature: float | None = None
    timestamps: bool | None = None
    response_format: ResponseFormat | None = None


@dataclass(slots=True)
class ContextStarted:
    context_started: ContextConfig
    type: Literal["context_started"] = "context_started"
    context_id: str | None = None


@dataclass(slots=True)
class AudioChunk:
    audio: bytes
    type: Literal["audio"] = "audio"
    context_id: str | None = None
    chunk_id: str | None = None


@dataclass(slots=True)
class Timestamps:
    timestamps: TTSTimestamps
    type: Literal["timestamps"] = "timestamps"
    context_id: str | None = None
    chunk_id: str | None = None


@dataclass(slots=True)
class FlushCompleted:
    flush_completed: Literal[True]
    flush_id: str
    type: Literal["flush_completed"] = "flush_completed"
    context_id: str | None = None
    chunk_id: str | None = None


@dataclass(slots=True)
class ContextClosed:
    context_closed: Literal[True]
    type: Literal["context_closed"] = "context_closed"
    context_id: str | None = None


@dataclass(slots=True)
class ErrorFrame:
    error: str
    type: Literal["error"] = "error"
    context_id: str | None = None
    flush_id: str | None = None
    chunk_id: str | None = None


WebSocketFrame: TypeAlias = (
    ContextStarted | AudioChunk | Timestamps | FlushCompleted | ContextClosed | ErrorFrame
)
