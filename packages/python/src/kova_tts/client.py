from __future__ import annotations

import base64
import struct
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse, urlunparse

from .errors import KovaTTSConnectionError, KovaTTSProtocolError, error_for_status
from .stream import parse_event_stream
from .types import ResponseFormat, StreamEvent, SyncTTSResponse, TTSTimestamps, TTSRequest
from .websocket import KovaTTSWebSocket

DEFAULT_BASE_URL = "https://api.evalabs.ai/v1/tts"


class KovaTTSClient:
    def __init__(
        self,
        *,
        api_key: str,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float | None = 30.0,
    ):
        self.api_key = api_key
        self.base_url = normalize_base_url(base_url)
        self.timeout = timeout

    def tts(
        self,
        *,
        text: str,
        voice: str,
        temperature: float | None = None,
        response_format: ResponseFormat | None = None,
        timestamps: bool | None = None,
    ) -> SyncTTSResponse:
        try:
            import httpx

            with httpx.Client(timeout=self.timeout) as client:
                response = client.post(
                    self._endpoint_url(),
                    headers=self._headers(),
                    json=serialize_tts_request(
                        TTSRequest(
                            text=text,
                            voice=voice,
                            temperature=temperature,
                            response_format=response_format,
                            timestamps=timestamps,
                        )
                    ),
                )
        except Exception as exc:
            if exc.__class__.__module__.startswith("httpx"):
                raise KovaTTSConnectionError(str(exc)) from exc
            raise

        if response.status_code >= 400:
            raise error_for_status(response.status_code, _response_body(response))
        return parse_sync_response(response.json())

    async def stream_tts(
        self,
        *,
        text: str,
        voice: str,
        temperature: float | None = None,
        response_format: ResponseFormat | None = None,
        timestamps: bool | None = None,
    ) -> AsyncIterator[StreamEvent]:
        try:
            import httpx

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                async with client.stream(
                    "POST",
                    self._endpoint_url("stream"),
                    headers=self._headers(),
                    json=serialize_tts_request(
                        TTSRequest(
                            text=text,
                            voice=voice,
                            temperature=temperature,
                            response_format=response_format,
                            timestamps=timestamps,
                        )
                    ),
                ) as response:
                    if response.status_code >= 400:
                        body = await response.aread()
                        raise error_for_status(response.status_code, body.decode("utf-8", "replace"))
                    async for event in parse_event_stream(response.aiter_lines()):
                        yield event
        except Exception as exc:
            if exc.__class__.__module__.startswith("httpx"):
                raise KovaTTSConnectionError(str(exc)) from exc
            raise

    def websocket(self) -> KovaTTSWebSocket:
        parsed = urlparse(self._endpoint_url("ws"))
        scheme = "wss" if parsed.scheme == "https" else "ws"
        return KovaTTSWebSocket(urlunparse(parsed._replace(scheme=scheme)), self.api_key)

    def write_audio_file(self, audio: str, path: str | Path) -> None:
        write_audio_file(audio, path)

    @staticmethod
    def decode_base64_bytes(value: str) -> bytes:
        return decode_base64_bytes(value)

    @staticmethod
    def decode_pcm16le_base64(value: str) -> list[int]:
        return decode_pcm16le_base64(value)

    def _headers(self) -> dict[str, str]:
        return {
            "content-type": "application/json",
            "x-api-key": self.api_key,
        }

    def _endpoint_url(self, suffix: str | None = None) -> str:
        if _base_points_to_tts_endpoint(self.base_url):
            return urljoin(self.base_url, suffix) if suffix else self.base_url.rstrip("/")
        endpoint = "v1/tts" + (f"/{suffix}" if suffix else "")
        return urljoin(self.base_url, endpoint)


def normalize_base_url(base_url: str) -> str:
    return base_url.rstrip("/") + "/"


def serialize_tts_request(request: TTSRequest) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "text": request.text,
        "voice": request.voice,
    }
    if request.temperature is not None:
        payload["temperature"] = request.temperature
    if request.response_format is not None:
        payload["response_format"] = request.response_format
    if request.timestamps is not None:
        payload["timestamps"] = request.timestamps
    return payload


def _base_points_to_tts_endpoint(base_url: str) -> bool:
    return urlparse(base_url).path.rstrip("/") == "/v1/tts"


def parse_sync_response(value: object) -> SyncTTSResponse:
    if not isinstance(value, dict):
        raise KovaTTSProtocolError("Sync TTS response must be an object")
    audio = value.get("audio")
    if not isinstance(audio, str):
        raise KovaTTSProtocolError("Sync TTS response is missing audio")
    timestamps = value.get("timestamps")
    return SyncTTSResponse(
        audio=audio,
        timestamps=_parse_timestamps(timestamps) if timestamps is not None else None,
    )


def decode_base64_bytes(value: str) -> bytes:
    return base64.b64decode(value)


def decode_pcm16le_base64(value: str) -> list[int]:
    data = decode_base64_bytes(value)
    if len(data) % 2:
        raise KovaTTSProtocolError("PCM16 data must have an even byte length")
    return list(struct.unpack(f"<{len(data) // 2}h", data))


def write_audio_file(audio: str, path: str | Path) -> None:
    Path(path).write_bytes(decode_base64_bytes(audio))


def _parse_timestamps(value: object) -> TTSTimestamps:
    if not isinstance(value, dict):
        raise KovaTTSProtocolError("Invalid timestamps payload")
    words = value.get("words")
    start_seconds = value.get("start_seconds")
    end_seconds = value.get("end_seconds")
    if not (isinstance(words, list) and isinstance(start_seconds, list) and isinstance(end_seconds, list)):
        raise KovaTTSProtocolError("Invalid timestamps payload")
    return TTSTimestamps(words=words, start_seconds=start_seconds, end_seconds=end_seconds)


def _response_body(response: Any) -> object:
    try:
        return response.json()
    except Exception:
        return response.text
