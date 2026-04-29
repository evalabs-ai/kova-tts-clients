from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, TypeAlias

ResponseFormat: TypeAlias = Literal["mp3", "wav", "m4a"]


@dataclass(slots=True)
class TTSRequest:
    text: str
    voice: str
    temperature: float | None = None
    response_format: ResponseFormat | None = None
    timestamps: bool | None = None


@dataclass(slots=True)
class TTSTimestamps:
    words: list[str]
    start_seconds: list[float]
    end_seconds: list[float]


@dataclass(slots=True)
class SyncTTSResponse:
    audio: str
    timestamps: TTSTimestamps | None = None


@dataclass(slots=True)
class StreamAudioEvent:
    type: Literal["audio"]
    audio_chunk: str

    def decode_pcm(self) -> list[int]:
        from .client import decode_pcm16le_base64

        return decode_pcm16le_base64(self.audio_chunk)


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


@dataclass(slots=True)
class ContextStarted:
    context_started: ContextConfig
    context_id: str | None = None


@dataclass(slots=True)
class AudioChunk:
    audio_chunk: str
    context_id: str | None = None
    chunk_id: str | None = None

    def decode_pcm(self) -> list[int]:
        from .client import decode_pcm16le_base64

        return decode_pcm16le_base64(self.audio_chunk)


@dataclass(slots=True)
class Timestamps:
    timestamps: TTSTimestamps
    context_id: str | None = None
    chunk_id: str | None = None


@dataclass(slots=True)
class FlushCompleted:
    flush_completed: Literal[True]
    flush_id: str
    context_id: str | None = None
    chunk_id: str | None = None


@dataclass(slots=True)
class ContextClosed:
    context_closed: Literal[True]
    context_id: str | None = None


@dataclass(slots=True)
class ErrorFrame:
    error: str
    context_id: str | None = None
    flush_id: str | None = None
    chunk_id: str | None = None


WebSocketFrame: TypeAlias = (
    ContextStarted | AudioChunk | Timestamps | FlushCompleted | ContextClosed | ErrorFrame
)
