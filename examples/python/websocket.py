import asyncio
import os

from kova_tts import KovaTTSClient


async def main() -> None:
    client = KovaTTSClient(
        api_key=os.environ["KOVA_API_KEY"],
    )

    async with client.websocket() as ws:
        await ws.start_context(
            context_id="ctx-1",
            voice_id=os.environ.get("KOVA_TEST_VOICE", "leon"),
            model_id="default",
            timestamps=True,
        )
        await ws.send_text("Hello ", context_id="ctx-1")
        await ws.send_text("world.", context_id="ctx-1")
        await ws.flush(context_id="ctx-1")

        async for frame in ws:
            print(frame)


asyncio.run(main())
