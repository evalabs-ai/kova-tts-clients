import os

from env import load_dotenv
from kova_tts import AudioResponseFormat, KovaTTSClient

load_dotenv()

client = KovaTTSClient(
    api_key=os.environ["KOVA_API_KEY"],
    base_url=os.environ.get("KOVA_BASE_URL", "https://api.evalabs.ai/v1/tts"),
)

result = client.tts(
    text="Hello world.",
    voice=os.environ.get("KOVA_TEST_VOICE", "cal"),
    response_format=AudioResponseFormat(encoding="mp3"),
    timestamps=True,
    normalize_text=True,
)

client.write_audio_file(result.audio, "out.mp3")
