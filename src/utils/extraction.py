import importlib
import json
import re


def load_extractor_fn(dotted_path: str):
    module_path, _, fn_name = dotted_path.rpartition(".")
    if not module_path:
        raise ValueError(f"extractor_fn must be 'module.function', got: {dotted_path!r}")
    module = importlib.import_module(module_path)
    fn = getattr(module, fn_name, None)
    if fn is None:
        raise AttributeError(f"No function {fn_name!r} in module {module_path!r}")
    return fn


def extraction_format_to_schema(extraction_format: dict) -> dict:
    JSON_TYPES = {"string", "number", "integer", "boolean", "array", "object", "null"}
    properties = {}
    for key, val in extraction_format.items():
        if isinstance(val, dict):
            properties[key] = val
        elif isinstance(val, str) and val.lower() in JSON_TYPES:
            properties[key] = {"type": val.lower()}
        else:
            properties[key] = {"type": "string", "description": str(val)}
    return {
        "type": "object",
        "properties": properties,
        "required": list(extraction_format.keys()),
    }


def parse_llm_result(raw: str, schema: dict | None) -> dict | str:
    if not schema:
        return raw
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    m = re.search(r'\{[\s\S]*\}', raw)
    if m:
        try:
            return json.loads(m.group())
        except json.JSONDecodeError:
            pass
    return raw
