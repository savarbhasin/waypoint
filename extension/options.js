const DEFAULT_WEB_APP_URL = "http://localhost:3000";

const urlInput = document.getElementById("web-app-url");
const saveBtn = document.getElementById("save");
const statusEl = document.getElementById("status");

function showStatus(message, tone) {
  statusEl.textContent = message;
  statusEl.className = `status ${tone}`;
}

function normalizeUrl(url) {
  return url.trim().replace(/\/+$/, "");
}

chrome.storage.local.get("webAppUrl", (data) => {
  urlInput.value = data.webAppUrl || DEFAULT_WEB_APP_URL;
});

saveBtn.addEventListener("click", async () => {
  const raw = urlInput.value.trim();
  if (!raw) {
    showStatus("Enter a valid URL.", "error");
    return;
  }

  let normalized;
  try {
    normalized = normalizeUrl(new URL(raw).toString());
  } catch {
    showStatus("Enter a valid URL (e.g. http://localhost:3000).", "error");
    return;
  }

  await chrome.storage.local.set({ webAppUrl: normalized });
  urlInput.value = normalized;
  showStatus("Settings saved.", "success");
});
