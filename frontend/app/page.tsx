import Link from "next/link";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/Wordmark";
import { StatusPip } from "@/components/StatusPip";
import { getSessionOrNull } from "@/lib/workflows/api";
import type { RunStatus } from "@/types/workflow";

const MOCK_STEPS: { type: string; label: string; detail: string; status: RunStatus }[] = [
  {
    type: "navigate",
    label: "Navigate",
    detail: 'page.goto("https://app.example.com/login")',
    status: "success",
  },
  {
    type: "fill",
    label: "Fill",
    detail: 'page.get_by_label("Email") → "{username}"',
    status: "success",
  },
  {
    type: "fill",
    label: "Fill",
    detail: 'page.get_by_label("Password") → "{password}"',
    status: "success",
  },
  {
    type: "click",
    label: "Click",
    detail: 'page.get_by_role("button", name="Sign in")',
    status: "healed",
  },
  {
    type: "extract",
    label: "Extract",
    detail: "method: screenshot · session token",
    status: "running",
  },
];

const PIPELINE = [
  {
    num: "01",
    title: "Record",
    body: "Injected capture.js logs every click, fill, select, and navigation as Playwright locator expressions. The DOM is the source of truth — no synthetic agent action traces.",
  },
  {
    num: "02",
    title: "Enrich",
    body: "An LLM pass extracts {param} tokens, rewrites step instructions, and flags dynamic locators with skip_command so they route straight to the healer instead of brittle retries.",
  },
  {
    num: "03",
    title: "Run",
    body: "The runner executes each recorded command with Playwright. When a locator fails after max_retries, a browser-use agent takes over — healed steps surface in amber on the timeline.",
  },
];

const CLI_LINES = [
  {
    prompt: "$",
    cmd: "python src/main.py record --output workflows/login.json --name login",
    comment: "# interact in Chrome, stop when done",
  },
  {
    prompt: "$",
    cmd: "python src/main.py process workflows/login.json",
    comment: "# LLM adds params, instructions, skip_command",
  },
  {
    prompt: "$",
    cmd: "python src/main.py run workflows/login.json --param username=jdoe",
    comment: null,
  },
];

function SignInButton({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/sign-in"
      className={`inline-flex items-center justify-center text-sm font-medium px-4 py-2.5 bg-amber border border-amber text-[#1a1206] rounded-md hover:bg-[#f0ac4c] transition-colors ${className}`}
    >
      Sign in to get started
    </Link>
  );
}

function HeroVisual() {
  return (
    <div className="border border-hairline-strong bg-panel rounded-lg overflow-hidden shadow-[0_24px_48px_rgba(0,0,0,0.35)]">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-hairline bg-ink-raised">
        <span className="w-2 h-2 rounded-full bg-fog-dim" />
        <span className="w-2 h-2 rounded-full bg-fog-dim" />
        <span className="w-2 h-2 rounded-full bg-fog-dim" />
        <span className="font-mono text-[0.625rem] uppercase tracking-widest text-fog-dim ml-2">
          record → process → run
        </span>
      </div>

      <div className="px-4 py-3.5 border-b border-hairline font-mono text-[0.6875rem] leading-relaxed">
        {CLI_LINES.map((line, i) => (
          <div key={i} className="flex flex-wrap gap-x-2">
            <span className="text-fog-dim select-none">{line.prompt}</span>
            <span className="text-paper-dim">{line.cmd}</span>
            {line.comment && <span className="text-fog-dim">{line.comment}</span>}
          </div>
        ))}
      </div>

      <div className="px-4 py-4">
        <div className="font-mono text-[0.625rem] uppercase tracking-widest text-fog-dim mb-3">
          Run · login.json
        </div>
        <div className="space-y-0">
          {MOCK_STEPS.map((step, i) => (
            <div key={i} className="flex items-stretch gap-3">
              <div className="flex w-7 shrink-0 flex-col items-center">
                {i > 0 && <div className="w-px flex-1 bg-hairline-strong" />}
                <div className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink">
                  <StatusPip status={step.status} />
                </div>
                {i < MOCK_STEPS.length - 1 && <div className="w-px flex-1 bg-hairline-strong" />}
              </div>
              <div className="min-w-0 flex-1 py-1.5 pb-3">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span
                    className={`font-mono text-[0.6875rem] uppercase tracking-wide px-1.5 py-0.5 rounded-sm border ${
                      step.type === "extract"
                        ? "text-signal border-signal-dim"
                        : "text-fog border-hairline-strong"
                    }`}
                  >
                    {step.label}
                  </span>
                  {step.status === "healed" && (
                    <span className="font-mono text-[0.6875rem] text-amber border border-amber-dim rounded-sm px-1.5 py-0.5">
                      AI healed
                    </span>
                  )}
                </div>
                <div className="font-mono text-[0.6875rem] text-fog-dim truncate">{step.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function LandingPage() {
  const session = await getSessionOrNull();
  if (session) redirect("/dashboard");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 border-b border-hairline bg-ink/80 backdrop-blur-sm">
        <div className="max-w-[1080px] mx-auto px-6 sm:px-8 h-14 flex items-center justify-between">
          <Wordmark compact />
          <Link
            href="/sign-in"
            className="text-sm font-medium px-3.5 py-1.5 text-amber border border-amber-dim rounded-md hover:bg-amber-dim transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-[1080px] mx-auto px-6 sm:px-8 pt-16 sm:pt-20 pb-20 sm:pb-28">
          <div className="grid lg:grid-cols-[1fr_minmax(0,420px)] gap-12 lg:gap-16 items-center">
            <div>
              <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-fog mb-5">
                Browser workflow studio
              </p>
              <h1 className="font-display text-[clamp(2.25rem,5vw,3.25rem)] leading-[1.08] text-paper mb-6">
                Record once.
                <br />
                <span className="italic text-amber">Replay</span> anywhere.
              </h1>
              <p className="text-paper-dim text-[1.0625rem] leading-relaxed max-w-[34rem] mb-8">
                Waypoint captures every click, fill, and navigation as deterministic Playwright steps.
                When a locator drifts, the runner retries the exact command — then hands off to an AI browser
                agent. Inspect workflows, parameterize runs, and watch steps heal in real time.
              </p>
              <SignInButton />
            </div>

            <div>
              <HeroVisual />
            </div>
          </div>
        </section>

        {/* Pipeline */}
        <section className="border-t border-hairline bg-panel/40">
          <div className="max-w-[1080px] mx-auto px-6 sm:px-8 py-16 sm:py-20">
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-fog mb-10">
              Three-stage pipeline
            </p>
            <div className="grid sm:grid-cols-3 gap-8 sm:gap-6">
              {PIPELINE.map((stage) => (
                <article key={stage.num} className="border-t border-hairline-strong pt-6">
                  <span className="font-mono text-[0.6875rem] text-amber tracking-widest">{stage.num}</span>
                  <h2 className="font-display text-[1.375rem] text-paper mt-2 mb-3">{stage.title}</h2>
                  <p className="text-fog text-sm leading-relaxed">{stage.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="border-t border-hairline">
          <div className="max-w-[1080px] mx-auto px-6 sm:px-8 py-16 sm:py-20 text-center">
            <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] text-paper mb-4">
              Your workflows, <span className="italic text-amber">inspectable</span> end to end.
            </h2>
            <p className="text-fog text-sm max-w-md mx-auto mb-8">
              Sign in to import recorded workflows, edit steps, trigger runs, and review heal history from
              the studio.
            </p>
            <SignInButton />
          </div>
        </section>
      </main>

      <footer className="border-t border-hairline mt-auto">
        <div className="max-w-[1080px] mx-auto px-6 sm:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Wordmark compact />
          <p className="font-mono text-[0.625rem] uppercase tracking-widest text-fog-dim">
            Record · enrich · run
          </p>
        </div>
      </footer>
    </div>
  );
}
