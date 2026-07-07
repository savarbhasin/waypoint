"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Wordmark } from "@/components/Wordmark";
import { signIn, useSession } from "@/lib/auth-client";

export default function SignInPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"google" | "github" | null>(null);

  useEffect(() => {
    if (isPending) return;
    if (session) router.replace("/dashboard");
  }, [isPending, session, router]);

  async function handleSocialSignIn(provider: "google" | "github") {
    setError(null);
    setLoading(provider);
    try {
      await signIn.social({
        provider,
        callbackURL: "/dashboard",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setLoading(null);
    }
  }

  if (isPending || session) {
    return (
      <div className="min-h-screen flex items-center justify-center text-fog text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md border border-hairline-strong bg-panel rounded-lg p-8">
        <div className="mb-8 flex justify-center">
          <Wordmark />
        </div>

        <div className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-fog mb-3 text-center">
          Sign in
        </div>
        <h1 className="font-display text-[1.75rem] leading-tight text-paper text-center mb-2">
          Continue to Waypoint
        </h1>
        <p className="text-fog text-sm text-center mb-8">
          Use Google or GitHub to access your workflows and run history.
        </p>

        {error && (
          <div className="mb-5 px-4 py-3 bg-ember-dim border border-ember rounded-md text-sm text-paper">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => handleSocialSignIn("google")}
            className="w-full text-sm font-medium px-4 py-2.5 bg-amber border border-amber text-[#1a1206] rounded-md hover:bg-[#f0ac4c] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading === "google" ? "Redirecting…" : "Continue with Google"}
          </button>
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => handleSocialSignIn("github")}
            className="w-full text-sm font-medium px-4 py-2.5 bg-panel-raised border border-hairline-strong text-paper rounded-md hover:border-fog disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading === "github" ? "Redirecting…" : "Continue with GitHub"}
          </button>
        </div>
      </div>
    </div>
  );
}
