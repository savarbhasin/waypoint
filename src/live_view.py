import asyncio
from typing import Any, Awaitable, Callable

from playwright.async_api import CDPSession, Page


class LiveView:
    def __init__(self, page: Page, on_frame: Callable[[str], Awaitable[None]]):
        self.page = page
        self.on_frame = on_frame
        self._cdp: CDPSession | None = None

    async def start(
        self,
        quality: int = 50,
        max_width: int = 1280,
        max_height: int = 800,
        every_nth_frame: int = 1,
    ) -> None:
        self._cdp = await self.page.context.new_cdp_session(self.page)
        self._cdp.on("Page.screencastFrame", self._on_screencast_frame)
        await self._cdp.send(
            "Page.startScreencast",
            {
                "format": "jpeg",
                "quality": quality,
                "maxWidth": max_width,
                "maxHeight": max_height,
                "everyNthFrame": every_nth_frame,
            },
        )

    def _on_screencast_frame(self, params: dict[str, Any]) -> None:
        asyncio.create_task(self._handle_frame(params))

    async def _handle_frame(self, params: dict[str, Any]) -> None:
        if self._cdp is None:
            return
        try:
            await self._cdp.send("Page.screencastFrameAck", {"sessionId": params["sessionId"]})
        except Exception:
            return
        await self.on_frame(params["data"])

    async def stop(self) -> None:
        if self._cdp is None:
            return
        try:
            await self._cdp.send("Page.stopScreencast")
        except Exception:
            pass
