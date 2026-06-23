import os
import re
from pathlib import Path

# ── Constants ─────────────────────────────────────────────────────────────────

BROWSER_LLM_MODEL = "gpt-5.5"

TASK_URL = "https://www.ohcaprovider.com/hcp/provider/Home/tabid/135/Default.aspx"
TASK_GOAL = (
    "Go to https://www.ohcaprovider.com/hcp/provider/Home/tabid/135/Default.aspx. "
    "Log in with username {username} and password {password}. "
    "If a security challenge question appears, answer it with {challenge}. "
    "Once logged in, find the eligibility check section and look up member ID {member}. "
    "Stop once the eligibility results are visible on screen or you see member id error."
)
WORKFLOW_NAME = "ohca_eligibility"
WORKFLOW_PATH = "workflows/ohca_eligibility.json"
EXTRACT_GOAL = "Extract the eligibility results for the member from the current page."
EXTRACT_FORMAT = {
    "member_id":   "string — the member ID that was looked up",
    "member_name": "string — full name of the member",
    "plan":        "string — plan or coverage name",
    "effective":   "string — coverage effective date",
    "termination": "string — coverage termination date if shown, else null",
}
# ── Prompts ───────────────────────────────────────────────────────────────────

RECORD_GOAL_SUFFIX = (
    "\n\nTake the most direct path possible — avoid redundant clicks, retry attempts, "
    "and navigation steps that are automatic side-effects of a preceding click. "
    "When done, output only the minimal sequence of steps that were truly necessary to achieve the goal."
)

EXTRACTOR_GEN_PROMPT = """Given the HTML page below, return a JSON object mapping each field name to a CSS selector that locates the element containing that field's value.

Extraction goal: {goal}
Fields to extract:
{fmt}

Rules:
- Prefer stable attributes: id, data-*, name, aria-label over positional or class selectors
- The selector must point to the element whose text content IS the value (or the input element itself for form fields)
- For input/select/textarea elements, point to the element — its value attribute will be read
- Return only raw JSON: {{"field_name": "css_selector", ...}} — no explanation, no markdown fences"""

# ── Helpers ───────────────────────────────────────────────────────────────────

def load_sensitive_data() -> dict:
    missing = [k for k in ("USERNAME", "PASSWORD", "CHALLENGE", "MEMBER") if not os.environ.get(k)]
    if missing:
        raise EnvironmentError(f"Missing required env vars: {', '.join(missing)}")
    return {
        "username":  os.environ["USERNAME"],
        "password":  os.environ["PASSWORD"],
        "challenge": os.environ["CHALLENGE"],
        "member":    os.environ["MEMBER"],
    }


def build_instruction(step: dict) -> str:
    t = step.get("type")
    label = step.get("label") or "element"
    if t == "navigate":
        return f"Navigate to {step.get('url', '')}"
    if t == "click":
        return f"Click '{label}'"
    if t == "fill":
        return f"Fill '{label}'"
    if t == "select":
        return f"Select option in '{label}'"
    return ""


def strip_fences(text: str) -> str:
    text = re.sub(r'^```(?:json|python)?\s*', '', text.strip())
    return re.sub(r'\s*```$', '', text)
