const DEFAULT_WEB_APP_URL = "http://localhost:3000";

const NAV_DEBOUNCE_AFTER_CLICK = 1.5;

const DEFAULT_STATE = {
  recording: false,
  steps: [],
  workflowName: "",
  tabId: null,
  lastUrl: "",
  lastClickTime: 0,
  lastClickNavigates: false,
  statusMessage: "",
  submissionStatus: null,
  savedWorkflow: null,
};

function buildInstruction(step) {
  const t = step.type;
  const label = step.label || "element";
  if (t === "navigate") return `Navigate to ${step.url || ""}`;
  if (t === "click") return `Click '${label}'`;
  if (t === "fill") return `Fill '${label}' with '${step.value || ""}'`;
  if (t === "select") return `Select '${step.value || ""}' in '${label}'`;
  if (t === "scroll") {
    const x = step.scroll_x ?? 0;
    const y = step.scroll_y ?? 0;
    return `Scroll to position (${x}, ${y})`;
  }
  return "";
}

async function getWebAppUrl() {
  const { webAppUrl } = await chrome.storage.local.get("webAppUrl");
  return (webAppUrl || DEFAULT_WEB_APP_URL).replace(/\/+$/, "");
}

async function notifyRecordingState(tabId, active) {
  if (!tabId) return;
  try {
    await chrome.tabs.sendMessage(tabId, { type: "recording_state", active });
  } catch {
    // Tab may not have a content script yet.
  }
}

function buildWorkflowStep(action) {
  const step = {
    type: action.type,
    instruction: buildInstruction(action),
    sleep_before: 0,
    duration: 0,
    skip_command: false,
    max_retries: 3,
  };
  if (action.command) step.command = action.command;
  if (action.url) step.url = action.url;
  if (action.value) step.value = action.value;
  if (action.scroll_x != null) step.scroll_x = action.scroll_x;
  if (action.scroll_y != null) step.scroll_y = action.scroll_y;
  return step;
}

async function getState() {
  const data = await chrome.storage.session.get("recordingState");
  return { ...DEFAULT_STATE, ...(data.recordingState || {}) };
}

async function saveState(state) {
  await chrome.storage.session.set({ recordingState: state });
}

async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });
  } catch (err) {
    console.warn("Failed to inject content script:", err);
  }
}

function onAction(state, action) {
  if (action.type === "click") {
    state.lastClickTime = Date.now();
    state.lastClickNavigates = !!action.click_navigates;
  }
  if (action.type === "fill") {
    for (let i = state.steps.length - 1; i >= 0; i--) {
      if (state.steps[i].type === "fill" && state.steps[i].command === action.command) {
        state.steps[i] = action;
        return state;
      }
    }
  }
  state.steps.push(action);
  return state;
}

async function handleNavigation(tabId, url) {
  let state = await getState();
  if (!state.recording || tabId !== state.tabId) return;

  if (!url || url === "about:blank" || url.startsWith("about:")) return;
  if (url === state.lastUrl) {
    await injectContentScript(tabId);
    return;
  }

  const elapsed = (Date.now() - state.lastClickTime) / 1000;
  if (state.lastClickNavigates || elapsed < NAV_DEBOUNCE_AFTER_CLICK) {
    state.lastClickNavigates = false;
    state.lastUrl = url;
    await saveState(state);
    await injectContentScript(tabId);
    return;
  }

  state.lastUrl = url;
  state.steps.push({ type: "navigate", url });
  state.statusMessage = `Recording… ${state.steps.length} steps captured`;
  await saveState(state);
  await injectContentScript(tabId);
}

async function submitRecording(state) {
  const { apiToken } = await chrome.storage.local.get("apiToken");
  if (!apiToken) {
    state.statusMessage = "Not signed in — connect your account in the popup.";
    state.submissionStatus = "error";
    await saveState(state);
    return;
  }

  const steps = state.steps.map(buildWorkflowStep);
  state.submissionStatus = "submitting";
  state.statusMessage = "Saving workflow…";
  await saveState(state);

  try {
    const webAppUrl = await getWebAppUrl();
    const res = await fetch(`${webAppUrl}/api/extension/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({ name: state.workflowName, steps }),
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      state.submissionStatus = "error";
      state.statusMessage = body.error || `Import failed (${res.status})`;
      await saveState(state);
      return;
    }

    state.submissionStatus = "success";
    state.savedWorkflow = { id: body.id, name: body.name };
    state.statusMessage = `Saved! View it at ${webAppUrl}/w/${body.name}`;
    state.steps = [];
    await saveState(state);
  } catch (err) {
    state.submissionStatus = "error";
    state.statusMessage = err instanceof Error ? err.message : "Network error during import";
    await saveState(state);
  }
}

async function stopRecording() {
  let state = await getState();
  if (!state.recording) return;
  const tabId = state.tabId;
  state.recording = false;
  state.statusMessage = state.steps.length
    ? `Stopped — ${state.steps.length} steps captured, saving…`
    : "Stopped — no steps captured";
  await saveState(state);
  await notifyRecordingState(tabId, false);
  await submitRecording(state);
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  handleNavigation(tabId, tab.url);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message.type === "start_recording") {
      const tabId = message.tabId;
      const workflowName = (message.workflowName || "recorded_workflow").trim() || "recorded_workflow";
      const tab = await chrome.tabs.get(tabId);
      const state = {
        ...DEFAULT_STATE,
        recording: true,
        steps: [],
        workflowName,
        tabId,
        lastUrl: tab.url || "",
        statusMessage: "Recording… 0 steps captured",
      };
      await saveState(state);
      await injectContentScript(tabId);
      await notifyRecordingState(tabId, true);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "stop_recording") {
      await stopRecording();
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "record_action") {
      let state = await getState();
      if (!state.recording) {
        sendResponse({ ok: false });
        return;
      }
      state = onAction(state, message.action);
      state.statusMessage = `Recording… ${state.steps.length} steps captured`;
      await saveState(state);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "get_state") {
      sendResponse(await getState());
      return;
    }
  })();
  return true;
});
