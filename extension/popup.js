const DEFAULT_WEB_APP_URL = "http://localhost:3000";

const connectView = document.getElementById("connect-view");
const recordView = document.getElementById("record-view");
const tokenInput = document.getElementById("token-input");
const saveTokenBtn = document.getElementById("save-token");
const openTokensBtn = document.getElementById("open-tokens");
const signOutBtn = document.getElementById("sign-out");
const workflowNameInput = document.getElementById("workflow-name");
const toggleBtn = document.getElementById("toggle-recording");
const statusEl = document.getElementById("status");
const connectStatusEl = document.getElementById("connect-status");

async function getWebAppUrl() {
  const { webAppUrl } = await chrome.storage.local.get("webAppUrl");
  return (webAppUrl || DEFAULT_WEB_APP_URL).replace(/\/+$/, "");
}

function showStatus(message, tone) {
  statusEl.textContent = message;
  statusEl.className = `status ${tone || ""}`;
  statusEl.classList.remove("hidden");
}

function hideStatus() {
  statusEl.classList.add("hidden");
}

function showConnectStatus(message, tone) {
  connectStatusEl.textContent = message;
  connectStatusEl.className = `status ${tone || ""}`;
  connectStatusEl.classList.remove("hidden");
}

function hideConnectStatus() {
  connectStatusEl.classList.add("hidden");
}

async function hasToken() {
  const { apiToken } = await chrome.storage.local.get("apiToken");
  return !!apiToken;
}

async function validateToken(token) {
  const webAppUrl = await getWebAppUrl();
  const res = await fetch(`${webAppUrl}/api/workflows`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.ok) return { ok: true };
  const body = await res.json().catch(() => ({}));
  return { ok: false, error: body.error || `Invalid token (${res.status})` };
}

async function refreshUI() {
  const signedIn = await hasToken();
  connectView.classList.toggle("hidden", signedIn);
  recordView.classList.toggle("hidden", !signedIn);

  if (!signedIn) return;

  const state = await chrome.runtime.sendMessage({ type: "get_state" });
  const recording = state?.recording ?? false;

  toggleBtn.textContent = recording ? "Stop recording" : "Start recording";
  toggleBtn.className = recording ? "btn-danger" : "btn-primary";
  workflowNameInput.disabled = recording;

  if (state?.statusMessage) {
    let tone = "";
    if (state.recording) tone = "recording";
    else if (state.submissionStatus === "success") tone = "success";
    else if (state.submissionStatus === "error") tone = "error";
    showStatus(state.statusMessage, tone);
  } else {
    hideStatus();
  }
}

openTokensBtn.addEventListener("click", async () => {
  const webAppUrl = await getWebAppUrl();
  chrome.tabs.create({ url: `${webAppUrl}/settings/tokens` });
});

saveTokenBtn.addEventListener("click", async () => {
  const token = tokenInput.value.trim();
  if (!token) {
    showConnectStatus("Enter an access token.", "error");
    return;
  }

  saveTokenBtn.disabled = true;
  hideConnectStatus();

  const result = await validateToken(token);
  if (!result.ok) {
    showConnectStatus(result.error || "Token validation failed.", "error");
    saveTokenBtn.disabled = false;
    return;
  }

  await chrome.storage.local.set({ apiToken: token });
  tokenInput.value = "";
  hideConnectStatus();
  saveTokenBtn.disabled = false;
  await refreshUI();
});

signOutBtn.addEventListener("click", async () => {
  await chrome.storage.local.remove("apiToken");
  hideConnectStatus();
  await refreshUI();
});

toggleBtn.addEventListener("click", async () => {
  const state = await chrome.runtime.sendMessage({ type: "get_state" });
  if (state?.recording) {
    toggleBtn.disabled = true;
    await chrome.runtime.sendMessage({ type: "stop_recording" });
    toggleBtn.disabled = false;
    await refreshUI();
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    showStatus("No active tab found.", "error");
    return;
  }

  const workflowName = workflowNameInput.value.trim() || "recorded_workflow";
  toggleBtn.disabled = true;
  await chrome.runtime.sendMessage({
    type: "start_recording",
    tabId: tab.id,
    workflowName,
  });
  toggleBtn.disabled = false;
  await refreshUI();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "session" && changes.recordingState) {
    refreshUI();
  }
});

refreshUI();
