import asyncio
import os

from kova_tts import KovaTTSClient


async def main() -> None:
    client = KovaTTSClient(
        api_key=os.environ["KOVA_API_KEY"],
    )

    async for event in client.stream_tts(
        text="Hello world.",
        voice=os.environ.get("KOVA_TEST_VOICE", "leon"),
        timestamps=True,
        normalize_text=True,
    ):
        if event.type == "audio":
            print(f"received {len(event.audio)} PCM bytes")
        else:
            print(" ".join(event.words))


asyncio.run(main())
