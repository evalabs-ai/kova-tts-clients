from collections.abc import AsyncIterator

import pytest

from kova_tts.stream import parse_event_stream, parse_sse_record


def test_parse_sse_audio_record() -> None:
    event = parse_sse_record('data: {"type":"audio","audio_chunk":"AAE="}')

    assert event is not None
    assert event.type == "audio"
    assert event.audio == b"\x00\x01"
    assert not hasattr(event, "audio_chunk")


def test_parse_sse_timestamps_record() -> None:
    event = parse_sse_record(
        'data: {"type":"timestamps","words":["hello"],"start_seconds":[0.0],"end_seconds":[0.3]}'
    )

    assert event is not None
    assert event.type == "timestamps"
    assert event.words == ["hello"]


@pytest.mark.asyncio
async def test_parse_event_stream_ignores_blank_separators() -> None:
    async def lines() -> AsyncIterator[str]:
        yield 'data: {"type":"audio","audio_chunk":"AAE="}'
        yield ""
        yield ""
        yield 'data: {"type":"timestamps","words":["hello"],"start_seconds":[0.0],"end_seconds":[0.3]}'

    events = [event async for event in parse_event_stream(lines())]

    assert [event.type for event in events] == ["audio", "timestamps"]
    assert events[0].audio == b"\x00\x01"
