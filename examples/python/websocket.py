import asyncio
import os

from env import load_dotenv
from kova_tts import AudioResponseFormat, KovaTTSClient

load_dotenv()


async def main() -> None:
    client = KovaTTSClient(
        api_key=os.environ["KOVA_API_KEY"],
        base_url=os.environ.get("KOVA_BASE_URL", "https://api.kova.ai/v1/tts"),
    )

    async with client.websocket() as ws:
        await ws.start_context(
            context_id="ctx-1",
            voice_id=os.environ.get("KOVA_TEST_VOICE", "cal"),
            model_id="default",
            timestamps=True,
            response_format=AudioResponseFormat(encoding="pcm", sample_rate=32000),
        )
        await ws.send_text("Hello ", context_id="ctx-1")
        await ws.send_text("world.", context_id="ctx-1")
        await ws.flush(context_id="ctx-1")

        async for frame in ws:
            match frame.type:
                case "context_started":
                    print("context started", frame.context_started)
                case "audio":
                    print(f"received {len(frame.audio)} audio bytes")
                case "timestamps":
                    print(" ".join(frame.timestamps.words))
                case "flush_completed":
                    print("flush completed", frame.flush_id)
                    break
                case "context_closed":
                    print("context closed", frame.context_id)


asyncio.run(main())
