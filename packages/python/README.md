# kova-tts

Python client for the Kova TTS API.

## Install

```sh
pip install kova-tts
```

## Setup

```py
from kova_tts import KovaTTSClient

client = KovaTTSClient(
    api_key="YOUR_API_KEY",
)
```

## Sync

```py
from kova_tts import AudioResponseFormat

result = client.tts(
    text="Hello world.",
    voice="cal",
    response_format=AudioResponseFormat(encoding="mp3"),
    timestamps=True,
    normalize_text=True,
)

client.write_audio_file(result.audio, "out.mp3")
print(result.timestamps.words if result.timestamps else None)
```

## Streaming

```py
from kova_tts import AudioResponseFormat

async for event in client.stream_tts(
    text="Hello world.",
    voice="cal",
    response_format=AudioResponseFormat(encoding="mp3"),
    timestamps=True,
    normalize_text=True,
):
    if event.type == "audio":
        print(f"received {len(event.audio)} audio bytes")
    elif event.type == "timestamps":
        print(event.words)
```

## WebSocket

```py
from kova_tts import AudioResponseFormat

async with client.websocket() as ws:
    await ws.start_context(
        context_id="ctx-1",
        voice_id="cal",
        model_id="default",
        timestamps=True,
        response_format=AudioResponseFormat(encoding="pcm", sample_rate=32000),
    )

    await ws.send_text("Hello ", context_id="ctx-1")
    await ws.send_text("world.", context_id="ctx-1")
    await ws.flush(context_id="ctx-1")

    async for frame in ws:
        match frame.type:
            case "audio":
                print(f"received {len(frame.audio)} audio bytes")
            case "timestamps":
                print(frame.timestamps.words)
            case "flush_completed":
                break
```

## Response Formats

`response_format` supports `mp3`, `pcm`, `wav`, `linear16`, `opus`, `mulaw`, and `alaw`.
