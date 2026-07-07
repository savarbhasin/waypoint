import os
from openai import AsyncOpenAI

class OpenAIClient:
    MODEL = "gpt-5.2"

    def __init__(self):
        self._client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    async def respond(self, instructions: str, user_input: str, reasoning_effort: str = "low") -> str:
        response = await self._client.responses.create(
            model=self.MODEL,
            reasoning={"effort": reasoning_effort},
            instructions=instructions,
            input=user_input,
        )
        return response.output_text.strip()

    async def complete(self, prompt: str) -> str:
        response = await self._client.responses.create(model=self.MODEL, input=prompt)
        return response.output_text.strip()

    async def vision(self, image_b64: str, prompt: str) -> str:
        response = await self._client.responses.create(
            model=self.MODEL,
            input=[{
                "role": "user",
                "content": [
                    {"type": "input_text", "text": prompt},
                    {"type": "input_image", "image_url": f"data:image/png;base64,{image_b64}"},
                ],
            }],
        )
        return response.output_text.strip()

openai = OpenAIClient()