import { getOwnedRun, getRunHistory, isTerminalStatus } from "@/lib/runs/api";
import { runHub } from "@/lib/runs/hub";
import type { RunEvent } from "@/lib/runs/types";
import { isTerminalEvent } from "@/lib/runs/types";
import { getSessionOrNull } from "@/lib/workflows/api";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const session = await getSessionOrNull();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const run = await getOwnedRun(session.user.id, id);
  if (!run) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const history = await getRunHistory(id);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const write = (event: RunEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      for (const event of history) {
        write(event);
      }

      if (isTerminalStatus(run.status)) {
        controller.close();
        return;
      }

      let closed = false;
      const close = () => {
        if (closed) {
          return;
        }
        closed = true;
        subscription.close();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      const subscription = runHub.subscribe(id, (event) => {
        if (closed) {
          return;
        }
        write(event);
        if (isTerminalEvent(event)) {
          close();
        }
      });

      request.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
