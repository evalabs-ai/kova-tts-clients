import pytest

from kova_tts.errors import KovaTTSProtocolError
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
        voice_id="leon",
        model_id="default",
        timestamps=True,
    ) == {
        "start_context": {
            "voice_id": "leon",
            "model_id": "default",
            "timestamps": True,
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
    ("frame", "class_name"),
    [
        (
            {
                "context_started": {
                    "voice_id": "leon",
                    "model_id": "default",
                },
                "context_id": "ctx-1",
            },
            "ContextStarted",
        ),
        ({"audio_chunk": "AAE=", "context_id": "ctx-1"}, "AudioChunk"),
        (
            {
                "timestamps": {
                    "words": ["hello"],
                    "start_seconds": [0.0],
                    "end_seconds": [0.3],
                }
            },
            "Timestamps",
        ),
        ({"flush_completed": True, "flush_id": "flush-1"}, "FlushCompleted"),
        ({"context_closed": True, "context_id": "ctx-1"}, "ContextClosed"),
        ({"error": "bad request", "context_id": "ctx-1"}, "ErrorFrame"),
    ],
)
def test_parse_websocket_frames(frame: dict[str, object], class_name: str) -> None:
    assert parse_websocket_frame(frame).__class__.__name__ == class_name


def test_parse_websocket_rejects_unknown_shape() -> None:
    with pytest.raises(KovaTTSProtocolError):
        parse_websocket_frame({"unknown": True})
