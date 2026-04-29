from __future__ import annotations

import json
from dataclasses import asdict
from types import TracebackType
from typing import Any

from .errors import KovaTTSConnectionError, KovaTTSProtocolError
from .types import (
    AudioChunk,
    ContextClosed,
    ContextConfig,
    ContextStarted,
    ErrorFrame,
    FlushCompleted,
    Timestamps,
    TTSTimestamps,
    WebSocketFrame,
)


def serialize_start_context(
    *,
    voice_id: str,
    model_id: str,
    context_id: str | None = None,
    temperature: float | None = None,
    timestamps: bool | None = None,
) -> dict[str, Any]:
    config: dict[str, Any] = {
        "voice_id": voice_id,
        "model_id": model_id,
    }
    if temperature is not None:
        config["temperature"] = temperature
    if timestamps is not None:
        config["timestamps"] = timestamps

    frame: dict[str, Any] = {"start_context": config}
    if context_id is not None:
        frame["context_id"] = context_id
    return frame


def serialize_send_text(text: str, *, context_id: str | None = None) -> dict[str, Any]:
    frame: dict[str, Any] = {"send_text": text}
    if context_id is not None:
        frame["context_id"] = context_id
    return frame


def serialize_flush(
    *, context_id: str | None = None, flush_id: str | None = None
) -> dict[str, Any]:
    frame: dict[str, Any] = {"flush": True}
    if context_id is not None:
        frame["context_id"] = context_id
    if flush_id is not None:
        frame["flush_id"] = flush_id
    return frame


def serialize_close_context(
    *, context_id: str | None = None, flush_id: str | None = None
) -> dict[str, Any]:
    frame: dict[str, Any] = {"close_context": True}
    if context_id is not None:
        frame["context_id"] = context_id
    if flush_id is not None:
        frame["flush_id"] = flush_id
    return frame


def parse_websocket_frame(value: object) -> WebSocketFrame:
    if not isinstance(value, dict):
        raise KovaTTSProtocolError("WebSocket frame must be an object")

    if isinstance(value.get("error"), str):
        return ErrorFrame(
            error=value["error"],
            context_id=value.get("context_id"),
            flush_id=value.get("flush_id"),
            chunk_id=value.get("chunk_id"),
        )

    context_started = value.get("context_started")
    if isinstance(context_started, dict):
        return ContextStarted(
            context_started=_parse_context_config(context_started),
            context_id=value.get("context_id"),
        )

    if isinstance(value.get("audio_chunk"), str):
        return AudioChunk(
            audio_chunk=value["audio_chunk"],
            context_id=value.get("context_id"),
            chunk_id=value.get("chunk_id"),
        )

    timestamps = value.get("timestamps")
    if isinstance(timestamps, dict):
        return Timestamps(
            timestamps=_parse_timestamps(timestamps),
            context_id=value.get("context_id"),
            chunk_id=value.get("chunk_id"),
        )

    if value.get("flush_completed") is True and isinstance(value.get("flush_id"), str):
        return FlushCompleted(
            flush_completed=True,
            flush_id=value["flush_id"],
            context_id=value.get("context_id"),
            chunk_id=value.get("chunk_id"),
        )

    if value.get("context_closed") is True:
        return ContextClosed(context_closed=True, context_id=value.get("context_id"))

    raise KovaTTSProtocolError(f"Unknown WebSocket frame shape: {value!r}")


class KovaTTSWebSocket:
    def __init__(self, url: str, api_key: str):
        self._url = url
        self._api_key = api_key
        self._socket = None

    async def __aenter__(self) -> "KovaTTSWebSocket":
        try:
            import websockets

            try:
                self._socket = await websockets.connect(
                    self._url,
                    additional_headers={"x-api-key": self._api_key},
                )
            except TypeError:
                self._socket = await websockets.connect(
                    self._url,
                    extra_headers={"x-api-key": self._api_key},
                )
        except Exception as exc:
            raise KovaTTSConnectionError(str(exc)) from exc
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        if self._socket is not None:
            await self._socket.close()

    def __aiter__(self) -> "KovaTTSWebSocket":
        return self

    async def __anext__(self) -> WebSocketFrame:
        if self._socket is None:
            raise KovaTTSConnectionError("WebSocket is not connected")
        try:
            raw = await self._socket.recv()
        except StopAsyncIteration:
            raise
        except Exception as exc:
            if exc.__class__.__name__ == "ConnectionClosedOK":
                raise StopAsyncIteration from exc
            raise KovaTTSConnectionError(str(exc)) from exc

        frame = parse_websocket_frame(json.loads(raw))
        if isinstance(frame, ErrorFrame):
            raise KovaTTSProtocolError(frame.error)
        return frame

    async def start_context(
        self,
        *,
        voice_id: str,
        model_id: str,
        context_id: str | None = None,
        temperature: float | None = None,
        timestamps: bool | None = None,
    ) -> None:
        await self._send(
            serialize_start_context(
                voice_id=voice_id,
                model_id=model_id,
                context_id=context_id,
                temperature=temperature,
                timestamps=timestamps,
            )
        )

    async def send_text(self, text: str, *, context_id: str | None = None) -> None:
        await self._send(serialize_send_text(text, context_id=context_id))

    async def flush(self, *, context_id: str | None = None, flush_id: str | None = None) -> None:
        await self._send(serialize_flush(context_id=context_id, flush_id=flush_id))

    async def close_context(
        self, *, context_id: str | None = None, flush_id: str | None = None
    ) -> None:
        await self._send(serialize_close_context(context_id=context_id, flush_id=flush_id))

    async def _send(self, frame: dict[str, Any]) -> None:
        if self._socket is None:
            raise KovaTTSConnectionError("WebSocket is not connected")
        await self._socket.send(json.dumps(frame))


def websocket_frame_to_dict(frame: WebSocketFrame) -> dict[str, Any]:
    return asdict(frame)


def _parse_context_config(value: dict[str, Any]) -> ContextConfig:
    if not isinstance(value.get("voice_id"), str) or not isinstance(value.get("model_id"), str):
        raise KovaTTSProtocolError("Invalid context config")
    return ContextConfig(
        voice_id=value["voice_id"],
        model_id=value["model_id"],
        temperature=value.get("temperature"),
        timestamps=value.get("timestamps"),
    )


def _parse_timestamps(value: dict[str, Any]) -> TTSTimestamps:
    words = value.get("words")
    start_seconds = value.get("start_seconds")
    end_seconds = value.get("end_seconds")
    if not (isinstance(words, list) and isinstance(start_seconds, list) and isinstance(end_seconds, list)):
        raise KovaTTSProtocolError("Invalid timestamps payload")
    return TTSTimestamps(words=words, start_seconds=start_seconds, end_seconds=end_seconds)
