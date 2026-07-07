import Link from "next/link";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/Wordmark";
import { StatusPip } from "@/components/StatusPip";
import { getSessionOrNull } from "@/lib/workflows/api";
import type { RunStatus } from "@/types/workflow";

const RUN_STEPS: { label: string; detail: string; status: RunStatus; note?: string }[] = [
  { label: "Open CRM", detail: "Sign in and load the lead queue", status: "success" },
  { label: "Find the lead", detail: "Search by email, open the record", status: "success" },
  { label: "Update status", detail: 'Set stage to "Qualified"', status: "success" },
  {
    label: "Save changes",
    detail: "Save button moved after last week's redesign",
    status: "healed",
    note: "Adapted automatically — no one had to fix this",
  },
  { label: "Confirm & log", detail: "Capture confirmation for the audit trail", status: "running" },
];

const BENEFITS = [
  {
    title: "Minutes, not sprints",
    body: "Show Waypoint the task once by doing it normally in your browser. No scripting, no locators to write, no engineer on the hook to build it.",
  },
  {
    title: "Maintenance drops to zero",
    body: "Every UI automation tool breaks when a button moves. Waypoint's AI steps in for just that one step and keeps going — so a redesign doesn't turn into a support ticket.",
  },
  {
    title: "Runs at a fraction of the cost",
    body: "Skip the headcount spent babysitting brittle test suites and RPA scripts. One recorded workflow keeps running, release after release, without a rewrite.",
  },
];

const USE_CASES = [
  {
    title: "Regression testing",
    body: "Catch broken checkout flows, forms, and dashboards before customers do — without maintaining a Selenium suite by hand.",
  },
  {
    title: "Back-office data entry",
    body: "Keep CRMs, spreadsheets, and internal admin tools in sync without a person copying values between tabs all day.",
  },
  {
    title: "Recurring reporting",
    body: "Pull the same numbers from five different dashboards every Monday morning — automatically, on schedule.",
  },
  {
    title: "Account & environment setup",
    body: "Provision accounts, apply settings, and configure new environments hands-free, the same way every time.",
  },
];

const HOW_IT_WORKS = [
  {
    num: "01",
    title: "Show it once",
    body: "Click through the task the normal way, in a real browser. Waypoint watches and turns it into a repeatable workflow — no code required.",
  },
  {
    num: "02",
    title: "It understands the intent",
    body: "Waypoint figures out what each step is actually trying to do, not just where you clicked — so the same workflow works with different inputs every time.",
  },
  {
    num: "03",
    title: "It heals when things change",
    body: "If a page gets redesigned, an AI agent takes over that one step instead of failing the whole run. Your automation survives changes that would break anything else.",
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
          Live run · Update CRM lead
        </span>
      </div>

      <div className="px-4 py-4">
        <div className="space-y-0">
          {RUN_STEPS.map((step, i) => (
            <div key={i} className="flex items-stretch gap-3">
              <div className="flex w-7 shrink-0 flex-col items-center">
                {i > 0 && <div className="w-px flex-1 bg-hairline-strong" />}
                <div className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink">
                  <StatusPip status={step.status} />
                </div>
                {i < RUN_STEPS.length - 1 && <div className="w-px flex-1 bg-hairline-strong" />}
              </div>
              <div className="min-w-0 flex-1 py-1.5 pb-4">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="text-[0.875rem] font-medium text-paper">{step.label}</span>
                  {step.status === "healed" && (
                    <span className="font-mono text-[0.625rem] uppercase tracking-wide text-amber border border-amber-dim rounded-sm px-1.5 py-0.5">
                      Adapted
                    </span>
                  )}
                  {step.status === "running" && (
                    <span className="inline-flex items-center gap-1 font-mono text-[0.625rem] uppercase tracking-wide text-signal">
                      <span className="w-1.5 h-1.5 rounded-full bg-signal animate-pulse" />
                      running
                    </span>
                  )}
                </div>
                <div className="text-[0.8125rem] text-fog">{step.note ?? step.detail}</div>
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
                Browser automation that doesn&apos;t break
              </p>
              <h1 className="font-display text-[clamp(2.25rem,5vw,3.25rem)] leading-[1.08] text-paper mb-6">
                Automate the busywork.
                <br />
                <span className="italic text-amber">Never touch it</span> again.
              </h1>
              <p className="text-paper-dim text-[1.0625rem] leading-relaxed max-w-[34rem] mb-8">
                Waypoint records any task you do in a browser and replays it on demand — logging into
                systems, filling forms, pulling reports, updating dashboards. When a page changes, an AI
                agent adapts on the spot instead of breaking the whole run. Faster to set up than a script,
                cheaper to keep running than a person.
              </p>
              <SignInButton />
            </div>

            <div>
              <HeroVisual />
            </div>
          </div>
        </section>

        {/* Why teams switch */}
        <section className="border-t border-hairline bg-panel/40">
          <div className="max-w-[1080px] mx-auto px-6 sm:px-8 py-16 sm:py-20">
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-fog mb-10">
              Why teams switch
            </p>
            <div className="grid sm:grid-cols-3 gap-8 sm:gap-6">
              {BENEFITS.map((b) => (
                <article key={b.title} className="border-t border-hairline-strong pt-6">
                  <h2 className="font-display text-[1.375rem] text-paper mb-3">{b.title}</h2>
                  <p className="text-fog text-sm leading-relaxed">{b.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Use cases */}
        <section className="border-t border-hairline">
          <div className="max-w-[1080px] mx-auto px-6 sm:px-8 py-16 sm:py-20">
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-fog mb-3">
              Built for
            </p>
            <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] text-paper mb-10 max-w-[28ch]">
              Anywhere your team repeats the same clicks
            </h2>
            <div className="grid sm:grid-cols-2 gap-5">
              {USE_CASES.map((u) => (
                <div
                  key={u.title}
                  className="p-5 bg-panel border border-hairline rounded-lg transition-colors hover:border-hairline-strong"
                >
                  <h3 className="text-[0.9375rem] font-medium text-paper mb-2">{u.title}</h3>
                  <p className="text-fog text-sm leading-relaxed">{u.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-hairline bg-panel/40">
          <div className="max-w-[1080px] mx-auto px-6 sm:px-8 py-16 sm:py-20">
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-fog mb-10">
              How it works
            </p>
            <div className="grid sm:grid-cols-3 gap-8 sm:gap-6">
              {HOW_IT_WORKS.map((stage) => (
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
              Stop paying people to <span className="italic text-amber">click the same buttons</span>.
            </h2>
            <p className="text-fog text-sm max-w-md mx-auto mb-8">
              Sign in to record your first workflow and watch it run, heal, and report back — no
              engineering ticket required.
            </p>
            <SignInButton />
          </div>
        </section>
      </main>

      <footer className="border-t border-hairline mt-auto">
        <div className="max-w-[1080px] mx-auto px-6 sm:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Wordmark compact />
          <p className="font-mono text-[0.625rem] uppercase tracking-widest text-fog-dim">
            Faster to set up. Cheaper to keep running.
          </p>
        </div>
      </footer>
    </div>
  );
}
