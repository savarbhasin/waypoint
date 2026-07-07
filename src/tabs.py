import asyncio
import logging
from typing import Awaitable, Callable, Optional

from playwright.async_api import BrowserContext, Page

logger = logging.getLogger(__name__)

OnActiveChange = Callable[[Page], Awaitable[None]]


class PageTracker:
    """Follows the "active" tab across a browser context: auto-switches to newly
    opened tabs (target="_blank" links, window.open, etc.) and falls back to the
    previous tab if the active one closes."""

    def __init__(self, context: BrowserContext, initial_page: Page, on_active_change: Optional[OnActiveChange] = None):
        self.context = context
        self.on_active_change = on_active_change
        self._active = initial_page
        self._watch(initial_page)
        context.on("page", self._handle_new_page)

    @property
    def page(self) -> Page:
        return self._active

    def _watch(self, page: Page) -> None:
        page.on("close", self._handle_close)

    def _handle_new_page(self, page: Page) -> None:
        logger.info("New tab opened — switching active tab")
        self._watch(page)
        self._set_active(page)

    def _handle_close(self, page: Page) -> None:
        if page is not self._active:
            return
        remaining = [p for p in self.context.pages if not p.is_closed()]
        if remaining:
            logger.info("Active tab closed — falling back to previous tab")
            self._set_active(remaining[-1])

    def _set_active(self, page: Page) -> None:
        self._active = page
        if self.on_active_change:
            asyncio.create_task(self.on_active_change(page))
