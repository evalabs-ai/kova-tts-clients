# kova-tts

Python client for the Kova TTS API.

Install directly from GitHub before PyPI publishing:

```sh
pip install git+https://github.com/evalabs-ai/kova-tts-clients.git
```

```py
from kova_tts import AudioResponseFormat, KovaTTSClient

client = KovaTTSClient(
    api_key="YOUR_API_KEY",
)

result = client.tts(
    text="Hello world.",
    voice="cal",
    response_format=AudioResponseFormat(encoding="mp3"),
    timestamps=True,
    normalize_text=True,
)

client.write_audio_file(result.audio, "out.mp3")
```

`result.audio` is decoded file bytes as `bytes`. Streaming audio events expose
decoded audio bytes on `event.audio`; WebSocket frames expose decoded PCM bytes
on `frame.audio`.

The default endpoint is `https://api.evalabs.ai/v1/tts`. Override `base_url`
only for staging or local servers.

Streaming and WebSocket APIs are async.
