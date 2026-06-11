"""
Handles 'extract' workflow steps — captures page content and queries an LLM.
"""
import base64
import anthropic
from playwright.async_api import Page


async def run_extract(page: Page, method: str, instruction: str, client: anthropic.AsyncAnthropic) -> str:
    if method == "screenshot":
        png = await page.screenshot(full_page=True)
        b64 = base64.standard_b64encode(png).decode()
        message = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {"type": "base64", "media_type": "image/png", "data": b64},
                    },
                    {"type": "text", "text": instruction},
                ],
            }],
        )
    else:  # html
        html = await page.content()
        # Trim very large pages to avoid token limits
        if len(html) > 100_000:
            html = html[:100_000] + "\n<!-- truncated -->"
        message = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            messages=[{
                "role": "user",
                "content": f"Given the following HTML, {instruction}\n\n```html\n{html}\n```",
            }],
        )

    result = message.content[0].text
    print(f"\n[extract] {instruction}\n{result}\n")
    return result
