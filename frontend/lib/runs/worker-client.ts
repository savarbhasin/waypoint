import type { RunEvent } from "@/lib/runs/types";
import { isTerminalEvent } from "@/lib/runs/types";
import WebSocket from "ws";

export function getServerWorkerUrl(): string {
  return process.env.WORKER_URL ?? "http://localhost:8787";
}

function workerWsUrl(workerRunId: string): string {
  return `${getServerWorkerUrl().replace(/^http/, "ws")}/runs/${workerRunId}/stream`;
}

export async function consumeWorkerRun(
  workerRunId: string,
  onEvent: (event: RunEvent) => Promise<void>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let terminal = false;
    let processing: Promise<void> = Promise.resolve();

    const finish = (error?: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    const ws = new WebSocket(workerWsUrl(workerRunId));

    ws.on("open", () => {
      // connected — events will follow
    });

    ws.on("message", (data) => {
      processing = processing
        .then(async () => {
          let event: RunEvent;
          try {
            event = JSON.parse(data.toString()) as RunEvent;
          } catch {
            return;
          }

          await onEvent(event);

          if (isTerminalEvent(event)) {
            terminal = true;
            ws.close();
            finish();
          }
        })
        .catch((error) => {
          terminal = true;
          ws.close();
          finish(error instanceof Error ? error : new Error(String(error)));
        });
    });

    ws.on("error", (error) => {
      processing.finally(() => {
        if (!terminal) {
          finish(error instanceof Error ? error : new Error(String(error)));
        }
      });
    });

    ws.on("close", () => {
      processing.finally(() => {
        if (!settled) {
          finish();
        }
      });
    });
  });
}

export async function startWorkerRun(
  workflow: Record<string, unknown>,
  params: Record<string, string>,
): Promise<{ run_id: string }> {
  const res = await fetch(`${getServerWorkerUrl()}/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workflow, params }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const error = new Error(body || res.statusText);
    (error as Error & { status: number }).status = res.status;
    throw error;
  }

  return res.json() as Promise<{ run_id: string }>;
}

export async function cancelWorkerRun(workerRunId: string): Promise<void> {
  try {
    await fetch(`${getServerWorkerUrl()}/runs/${workerRunId}/cancel`, { method: "POST" });
  } catch {
    // best-effort, idempotent on worker side
  }
}
