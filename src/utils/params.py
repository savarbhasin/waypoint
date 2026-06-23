from playwright.async_api import Page


def parse_cli_params(raw: list[str] | None) -> dict:
    return {k.strip(): v.strip() for kv in (raw or []) for k, _, v in [kv.partition("=")]}


def resolve_params(value: str, params: dict) -> str:
    for k, v in params.items():
        value = value.replace(f"{{{k}}}", str(v))
    return value


def get_locator(page: Page, command: str):
    return eval(f"page.{command}", {"__builtins__": {}}, {"page": page})
