from __future__ import annotations

import base64
import struct

from .errors import KovaTTSProtocolError


def decode_base64_bytes(value: str) -> bytes:
    return base64.b64decode(value)


def decode_pcm16le_base64(value: str) -> list[int]:
    data = decode_base64_bytes(value)
    if len(data) % 2:
        raise KovaTTSProtocolError("PCM16 data must have an even byte length")
    return list(struct.unpack(f"<{len(data) // 2}h", data))
