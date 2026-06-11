"""
Records user browser interactions and saves them as a workflow JSON.
"""
import asyncio
import signal
import time
from playwright.async_api import async_playwright
from workflow import Workflow, WorkflowStep

NAV_DEBOUNCE_AFTER_CLICK = 1.5  # seconds

CAPTURE_SCRIPT = r"""
(function() {
  if (window.__recorderAttached) return;
  window.__recorderAttached = true;

  // ── Stop button ───────────────────────────────────────────────────────────
  function injectStopButton() {
    if (document.getElementById('__bap_stop')) return;
    const btn = document.createElement('button');
    btn.id = '__bap_stop';
    btn.innerText = '⏹ Stop Recording';
    Object.assign(btn.style, {
      position: 'fixed', bottom: '20px', right: '20px', zIndex: '2147483647',
      background: '#e53e3e', color: '#fff', border: 'none', borderRadius: '8px',
      padding: '10px 18px', fontSize: '14px', fontWeight: '600',
      cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,.35)',
      fontFamily: 'system-ui, sans-serif',
    });
    btn.onclick = function(e) {
      e.stopPropagation(); e.preventDefault();
      btn.innerText = 'Saving…'; btn.disabled = true;
      window.__stopRecording();
    };
    document.body.appendChild(btn);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectStopButton);
  } else {
    injectStopButton();
  }

  // ── ARIA role inference ───────────────────────────────────────────────────
  // Maps tag+type → ARIA role used in get_by_role()
  const TAG_ROLE = {
    'a': 'link', 'button': 'button', 'select': 'combobox',
    'textarea': 'textbox', 'h1': 'heading', 'h2': 'heading',
    'h3': 'heading', 'img': 'img', 'li': 'listitem',
    'nav': 'navigation', 'main': 'main', 'table': 'table',
    'checkbox': 'checkbox', 'radio': 'radio', 'range': 'slider',
    'spinbutton': 'spinbutton',
  };
  const INPUT_ROLE = {
    'text': 'textbox', 'email': 'textbox', 'password': 'textbox',
    'search': 'searchbox', 'url': 'textbox', 'tel': 'textbox',
    'number': 'spinbutton', 'checkbox': 'checkbox', 'radio': 'radio',
    'range': 'slider',
  };

  function getRole(el) {
    const explicit = el.getAttribute('role');
    if (explicit) return explicit;
    const tag = el.tagName.toLowerCase();
    if (tag === 'input') return INPUT_ROLE[el.type] || 'textbox';
    return TAG_ROLE[tag] || null;
  }

  // Accessible name: what screen readers / Playwright see as the element's name
  function getAccessibleName(el) {
    return (
      el.getAttribute('aria-label') ||
      el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby'))?.innerText ||
      el.getAttribute('title') ||
      el.getAttribute('placeholder') ||
      el.getAttribute('alt') ||
      (el.tagName !== 'INPUT' && el.tagName !== 'SELECT' ? (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 80) : '') ||
      el.getAttribute('name') ||
      null
    );
  }

  // Build the best Playwright locator command for this element
  function getCommand(el) {
    const role = getRole(el);
    const name = getAccessibleName(el);

    if (role && name) {
      const escapedName = name.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      return `get_by_role("${role}", name="${escapedName}")`;
    }
    if (el.getAttribute('placeholder')) {
      return `get_by_placeholder("${el.getAttribute('placeholder').replace(/"/g, '\\"')}")`;
    }
    if (el.getAttribute('aria-label')) {
      return `get_by_label("${el.getAttribute('aria-label').replace(/"/g, '\\"')}")`;
    }
    // Fallback to CSS locator
    return `locator("${getCSSSelector(el).replace(/"/g, '\\"')}")`;
  }

  function getCSSSelector(el) {
    if (!el || el === document.body) return 'body';
    if (el.id) return '#' + el.id;
    const testid = el.getAttribute('data-testid') || el.getAttribute('data-test-id');
    if (testid) return `[data-testid="${testid}"]`;
    const name = el.getAttribute('name');
    if (name) return `${el.tagName.toLowerCase()}[name="${name}"]`;
    return getCSSPath(el);
  }

  function getCSSPath(el) {
    const parts = [];
    while (el && el.nodeType === Node.ELEMENT_NODE) {
      let seg = el.tagName.toLowerCase();
      if (el.id) { parts.unshift('#' + el.id); break; }
      const siblings = Array.from(el.parentNode?.children || []).filter(c => c.tagName === el.tagName);
      if (siblings.length > 1) seg += ':nth-of-type(' + (siblings.indexOf(el) + 1) + ')';
      parts.unshift(seg);
      el = el.parentElement;
      if (parts.length > 4) break;
    }
    return parts.join(' > ');
  }

  // Human-readable label (for instruction text)
  function getLabel(el) {
    let node = el;
    for (let i = 0; i < 5; i++) {
      if (!node || node === document.body) break;
      const label =
        node.getAttribute('aria-label') ||
        node.getAttribute('title') ||
        node.getAttribute('alt') ||
        (node.tagName === 'INPUT' ? node.getAttribute('placeholder') : null) ||
        (node.innerText || '').trim().replace(/\s+/g, ' ');
      if (label && label.length > 0) return label.slice(0, 80);
      node = node.parentElement;
    }
    const role = getRole(el);
    return role || el.tagName.toLowerCase();
  }

  function findAnchorHref(el) {
    let node = el;
    while (node && node !== document.body) {
      if (node.tagName === 'A' && node.href && !node.href.startsWith('javascript:')) {
        return node.href;
      }
      node = node.parentElement;
    }
    return null;
  }

  // ── Event listeners ───────────────────────────────────────────────────────
  document.addEventListener('click', function(e) {
    const el = e.target;
    if (el.id === '__bap_stop') return;
    const tag = el.tagName.toLowerCase();
    if (['script', 'style'].includes(tag)) return;
    const href = findAnchorHref(el);
    window.__recordAction({
      type: 'click',
      command: getCommand(el),
      label: getLabel(el),
      click_navigates: !!href,
      href: href || null,
    });
  }, true);

  document.addEventListener('change', function(e) {
    const el = e.target;
    const tag = el.tagName.toLowerCase();
    if (tag === 'select') {
      window.__recordAction({
        type: 'select',
        command: getCommand(el),
        value: el.value,
        label: el.options[el.selectedIndex]?.text || getLabel(el),
      });
    } else if (['input', 'textarea'].includes(tag)) {
      window.__recordAction({
        type: 'fill',
        command: getCommand(el),
        value: el.value,
        label: getLabel(el),
      });
    }
  }, true);
})();
"""


def build_instruction(step: dict) -> str:
    t = step.get("type")
    label = step.get("label") or "element"
    if t == "navigate":
        return f"Navigate to {step.get('url', '')}"
    if t == "click":
        return f"Click '{label}'"
    if t == "fill":
        return f"Fill '{label}' with '{step.get('value', '')}'"
    if t == "select":
        return f"Select '{step.get('value', '')}' in '{label}'"
    return ""


async def record(output_path: str, name: str = "recorded_workflow") -> None:
    steps: list[dict] = []
    last_click_time: list[float] = [0.0]
    last_click_navigates: list[bool] = [False]
    done = asyncio.Event()

    def on_action(action: dict) -> None:
        if action.get("type") == "click":
            last_click_time[0] = time.monotonic()
            last_click_navigates[0] = bool(action.get("click_navigates"))
        # Deduplicate consecutive fills on the same command
        if action.get("type") == "fill":
            for i in range(len(steps) - 1, -1, -1):
                if steps[i].get("type") == "fill" and steps[i].get("command") == action.get("command"):
                    steps[i] = action
                    print(f"  [{i+1:02d}] fill     (updated) {build_instruction(action)}")
                    return
        steps.append(action)
        print(f"  [{len(steps):02d}] {action['type']:8s}  {build_instruction(action)}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            channel="chrome",
            headless=False,
            args=["--no-first-run", "--no-default-browser-check"],
        )
        context = await browser.new_context()
        page = await context.new_page()

        loop = asyncio.get_event_loop()

        # Use context-level expose so functions survive page navigations
        await context.expose_function("__recordAction", on_action)
        await context.expose_function("__stopRecording",
                                      lambda: loop.call_soon_threadsafe(done.set))
        await context.add_init_script(CAPTURE_SCRIPT)
        await page.evaluate(CAPTURE_SCRIPT)

        last_url = ""

        def on_frame_navigated(frame):
            nonlocal last_url
            if frame != page.main_frame:
                return
            url = frame.url
            if url in ("about:blank", last_url) or url.startswith("about:"):
                return
            elapsed = time.monotonic() - last_click_time[0]
            if last_click_navigates[0] or elapsed < NAV_DEBOUNCE_AFTER_CLICK:
                last_click_navigates[0] = False
                last_url = url
                return
            last_url = url
            steps.append({"type": "navigate", "url": url})
            print(f"  [{len(steps):02d}] navigate  Navigate to {url}")

        page.on("framenavigated", on_frame_navigated)

        loop.add_signal_handler(signal.SIGINT, lambda: done.set())

        print("\nBrowser is open. Perform your actions.")
        print("Click '⏹ Stop Recording' in the browser, or press Ctrl+C to save.\n")

        await done.wait()
        loop.remove_signal_handler(signal.SIGINT)

        try:
            await browser.close()
        except Exception:
            pass

    workflow = Workflow(name=name)
    for s in steps:
        step = WorkflowStep(
            type=s["type"],
            instruction=build_instruction(s),
            command=s.get("command"),
            url=s.get("url"),
            value=s.get("value"),
        )
        workflow.steps.append(step)

    workflow.save(output_path)
    print(f"\nSaved {len(workflow.steps)} steps to {output_path}")
