from playwright.async_api import Page


def resolve_params(value: str, params: dict) -> str:
    for k, v in params.items():
        value = value.replace(f"{{{k}}}", str(v))
    return value


def get_locator(page: Page, command: str):
    return eval(f"page.{command}", {"__builtins__": {}}, {"page": page})
