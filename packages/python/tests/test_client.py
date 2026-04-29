import base64
import struct

import pytest

from kova_tts.client import (
    decode_base64_bytes,
    decode_pcm16le_base64,
    parse_sync_response,
    serialize_tts_request,
)
from kova_tts.errors import KovaTTSProtocolError
from kova_tts.types import TTSRequest


def test_serialize_tts_request_omits_sampling_params() -> None:
    payload = serialize_tts_request(
        TTSRequest(
            text="Hello",
            voice="leon",
            temperature=0.7,
            response_format="mp3",
            timestamps=True,
        )
    )

    assert payload == {
        "text": "Hello",
        "voice": "leon",
        "temperature": 0.7,
        "response_format": "mp3",
        "timestamps": True,
    }
    assert "sampling_params" not in payload


def test_endpoint_url_accepts_origin_or_full_tts_path() -> None:
    from kova_tts import KovaTTSClient

    default_client = KovaTTSClient(api_key="dummy-api-key")
    origin_client = KovaTTSClient(api_key="dummy-api-key", base_url="https://api.evalabs.ai")
    full_path_client = KovaTTSClient(
        api_key="dummy-api-key",
        base_url="https://api.evalabs.ai/v1/tts",
    )

    assert default_client._endpoint_url() == "https://api.evalabs.ai/v1/tts"
    assert default_client._endpoint_url("stream") == "https://api.evalabs.ai/v1/tts/stream"
    assert origin_client._endpoint_url() == "https://api.evalabs.ai/v1/tts"
    assert origin_client._endpoint_url("stream") == "https://api.evalabs.ai/v1/tts/stream"
    assert full_path_client._endpoint_url() == "https://api.evalabs.ai/v1/tts"
    assert full_path_client._endpoint_url("stream") == "https://api.evalabs.ai/v1/tts/stream"


def test_parse_sync_response_with_timestamps() -> None:
    parsed = parse_sync_response(
        {
            "audio": "AAE=",
            "timestamps": {
                "words": ["hello"],
                "start_seconds": [0.0],
                "end_seconds": [0.3],
            },
        }
    )

    assert parsed.audio == "AAE="
    assert parsed.timestamps is not None
    assert parsed.timestamps.words == ["hello"]


def test_parse_sync_response_without_timestamps() -> None:
    parsed = parse_sync_response({"audio": "AAE="})

    assert parsed.audio == "AAE="
    assert parsed.timestamps is None


def test_base64_helpers_round_trip() -> None:
    data = struct.pack("<3h", -1, 0, 42)
    encoded = base64.b64encode(data).decode("ascii")

    assert decode_base64_bytes(encoded) == data
    assert decode_pcm16le_base64(encoded) == [-1, 0, 42]


def test_decode_pcm_rejects_odd_byte_count() -> None:
    with pytest.raises(KovaTTSProtocolError):
        decode_pcm16le_base64(base64.b64encode(b"x").decode("ascii"))
