import pytest

from kova_tts.errors import KovaTTSProtocolError
from kova_tts.types import AudioResponseFormat
from kova_tts.websocket import (
    parse_websocket_frame,
    serialize_close_context,
    serialize_flush,
    serialize_send_text,
    serialize_start_context,
)


def test_websocket_frame_serialization() -> None:
    assert serialize_start_context(
        context_id="ctx-1",
        voice_id="cal",
        model_id="default",
        timestamps=True,
        response_format=AudioResponseFormat(encoding="pcm", sample_rate=32000),
    ) == {
        "start_context": {
            "voice_id": "cal",
            "model_id": "default",
            "timestamps": True,
            "response_format": {"encoding": "pcm", "sample_rate": 32000},
        },
        "context_id": "ctx-1",
    }
    assert serialize_send_text("Hello", context_id="ctx-1") == {
        "send_text": "Hello",
        "context_id": "ctx-1",
    }
    assert serialize_flush(context_id="ctx-1", flush_id="flush-1") == {
        "flush": True,
        "context_id": "ctx-1",
        "flush_id": "flush-1",
    }
    assert serialize_close_context(context_id="ctx-1") == {
        "close_context": True,
        "context_id": "ctx-1",
    }


@pytest.mark.parametrize(
    ("frame", "class_name", "frame_type"),
    [
        (
            {
                "context_started": {
                    "voice_id": "cal",
                    "model_id": "default",
                },
                "context_id": "ctx-1",
            },
            "ContextStarted",
            "context_started",
        ),
        ({"audio_chunk": "AAE=", "context_id": "ctx-1"}, "AudioChunk", "audio"),
        (
            {
                "timestamps": {
                    "words": ["hello"],
                    "start_seconds": [0.0],
                    "end_seconds": [0.3],
                }
            },
            "Timestamps",
            "timestamps",
        ),
        ({"flush_completed": True, "flush_id": "flush-1"}, "FlushCompleted", "flush_completed"),
        ({"context_closed": True, "context_id": "ctx-1"}, "ContextClosed", "context_closed"),
        ({"error": "bad request", "context_id": "ctx-1"}, "ErrorFrame", "error"),
    ],
)
def test_parse_websocket_frames(frame: dict[str, object], class_name: str, frame_type: str) -> None:
    parsed = parse_websocket_frame(frame)

    assert parsed.__class__.__name__ == class_name
    assert parsed.type == frame_type


def test_parse_websocket_audio_frame_decodes_pcm() -> None:
    frame = parse_websocket_frame({"audio_chunk": "AAE=", "context_id": "ctx-1"})

    assert frame.__class__.__name__ == "AudioChunk"
    assert frame.type == "audio"
    assert frame.audio == b"\x00\x01"
    assert not hasattr(frame, "audio_chunk")


def test_parse_websocket_context_started_response_format() -> None:
    frame = parse_websocket_frame(
        {
            "context_started": {
                "voice_id": "cal",
                "model_id": "default",
                "response_format": {"encoding": "pcm", "sample_rate": 32000},
            },
            "context_id": "ctx-1",
        }
    )

    assert frame.__class__.__name__ == "ContextStarted"
    assert frame.context_started.response_format == AudioResponseFormat(
        encoding="pcm",
        sample_rate=32000,
    )


def test_parse_websocket_rejects_unknown_shape() -> None:
    with pytest.raises(KovaTTSProtocolError):
        parse_websocket_frame({"unknown": True})
