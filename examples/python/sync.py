import os

from kova_tts import KovaTTSClient

client = KovaTTSClient(
    api_key=os.environ["KOVA_API_KEY"],
)

result = client.tts(
    text="Hello world.",
    voice=os.environ.get("KOVA_TEST_VOICE", "leon"),
    response_format="mp3",
    timestamps=True,
)

client.write_audio_file(result.audio, "out.mp3")
