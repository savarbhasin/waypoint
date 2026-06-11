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

openai = OpenAIClient()