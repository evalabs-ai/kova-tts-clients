from __future__ import annotations

import json
from collections.abc import AsyncIterator

from .errors import KovaTTSProtocolError
from .types import StreamAudioEvent, StreamEvent, StreamTimestampsEvent


def parse_stream_event(value: object) -> StreamEvent:
    if not isinstance(value, dict):
        raise KovaTTSProtocolError("Stream event must be an object")

    if value.get("type") == "audio" and isinstance(value.get("audio_chunk"), str):
        return StreamAudioEvent(type="audio", audio_chunk=value["audio_chunk"])

    if value.get("type") == "timestamps":
        words = value.get("words")
        start_seconds = value.get("start_seconds")
        end_seconds = value.get("end_seconds")
        if isinstance(words, list) and isinstance(start_seconds, list) and isinstance(end_seconds, list):
            return StreamTimestampsEvent(
                type="timestamps",
                words=words,
                start_seconds=start_seconds,
                end_seconds=end_seconds,
            )

    raise KovaTTSProtocolError(f"Unknown stream event shape: {value!r}")


def parse_sse_record(record: str) -> StreamEvent | None:
    data = "\n".join(
        line.strip()[5:].strip()
        for line in record.splitlines()
        if line.strip().startswith("data:")
    )
    if not data:
        return None
    return parse_stream_event(json.loads(data))


async def parse_event_stream(lines: AsyncIterator[str]) -> AsyncIterator[StreamEvent]:
    record_lines: list[str] = []
    async for line in lines:
        if line.strip():
            record_lines.append(line)
            continue
        event = parse_sse_record("\n".join(record_lines))
        record_lines = []
        if event is not None:
            yield event

    if record_lines:
        event = parse_sse_record("\n".join(record_lines))
        if event is not None:
            yield event
