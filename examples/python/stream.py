import asyncio
import os

from env import load_dotenv
from kova_tts import KovaTTSClient

load_dotenv()


async def main() -> None:
    client = KovaTTSClient(
        api_key=os.environ["KOVA_API_KEY"],
    )

    async for event in client.stream_tts(
        text="Hello world.",
        voice=os.environ.get("KOVA_TEST_VOICE", "cal"),
        timestamps=True,
        normalize_text=True,
    ):
        if event.type == "audio":
            print(f"received {len(event.audio)} audio bytes")
        else:
            print(" ".join(event.words))


asyncio.run(main())
