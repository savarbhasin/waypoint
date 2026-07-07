from anthropic import AsyncAnthropic

class AnthropicClient:
    MODEL = "claude-sonnet-4-6"
    MAX_TOKENS = 4096

    def __init__(self):
        self._client = AsyncAnthropic()

    async def complete(self, prompt: str) -> str:
        msg = await self._client.messages.create(
            model=self.MODEL,
            max_tokens=self.MAX_TOKENS,
            messages=[{"role": "user", "content": prompt}],
        )
        return msg.content[0].text

    async def vision(self, image_b64: str, prompt: str) -> str:
        msg = await self._client.messages.create(
            model=self.MODEL,
            max_tokens=self.MAX_TOKENS,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": image_b64}},
                    {"type": "text", "text": prompt},
                ],
            }],
        )
        return msg.content[0].text

anthropic = AnthropicClient()