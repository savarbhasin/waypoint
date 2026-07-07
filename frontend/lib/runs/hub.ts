import type { RunEvent } from "@/lib/runs/types";

type RunEventListener = (event: RunEvent) => void;

export interface RunSubscription {
  send: (event: RunEvent) => void;
  close: () => void;
}

class RunHub {
  private listeners = new Map<string, Set<RunEventListener>>();

  subscribe(dbRunId: string, onEvent: RunEventListener): RunSubscription {
    let listeners = this.listeners.get(dbRunId);
    if (!listeners) {
      listeners = new Set();
      this.listeners.set(dbRunId, listeners);
    }

    const send: RunEventListener = (event) => onEvent(event);
    listeners.add(send);

    return {
      send,
      close: () => {
        listeners!.delete(send);
        if (listeners!.size === 0) {
          this.listeners.delete(dbRunId);
        }
      },
    };
  }

  publish(dbRunId: string, event: RunEvent): void {
    const listeners = this.listeners.get(dbRunId);
    if (!listeners) {
      return;
    }
    for (const send of listeners) {
      send(event);
    }
  }
}

declare global {
  var __waypointRunHub: RunHub | undefined;
}

function createRunHub(): RunHub {
  return new RunHub();
}

export const runHub = globalThis.__waypointRunHub ?? createRunHub();

if (process.env.NODE_ENV !== "production") {
  globalThis.__waypointRunHub = runHub;
}
