"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, KeyRound, Trash2 } from "lucide-react";

interface TokenListItem {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

function formatDate(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString();
}

export default function TokensSettingsPage() {
  const [tokens, setTokens] = useState<TokenListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const loadTokens = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tokens");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to load tokens (${res.status})`);
      }
      setTokens(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tokens");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTokens();
  }, [loadTokens]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Chrome Extension" }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Failed to generate token (${res.status})`);
      setNewToken(body.token);
      await loadTokens();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate token");
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    if (!newToken) return;
    await navigator.clipboard.writeText(newToken);
    setCopied(true);
  }

  async function handleRevoke(id: string) {
    setRevokingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/tokens/${id}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Failed to revoke token (${res.status})`);
      await loadTokens();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke token");
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <div className="min-h-screen max-w-[720px] mx-auto px-8 pt-8 pb-20">
      <div className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-fog mb-3">
        Settings
      </div>
      <h1 className="font-display text-[2rem] leading-tight text-paper mb-2 flex items-center gap-2">
        <KeyRound size={22} className="text-amber" />
        Access tokens
      </h1>
      <p className="text-fog text-sm mb-8 max-w-[52ch]">
        Generate a personal access token for the Waypoint Chrome extension. Tokens are shown once
        at creation — store them securely.
      </p>

      {error && (
        <div className="mb-6 px-4 py-3 bg-ember-dim border border-ember rounded-md text-sm text-paper">
          {error}
        </div>
      )}

      <div className="border border-hairline-strong bg-panel rounded-lg p-6 mb-8">
        <button
          type="button"
          disabled={generating}
          onClick={handleGenerate}
          className="text-sm font-medium px-4 py-2.5 bg-amber border border-amber text-[#1a1206] rounded-md hover:bg-[#f0ac4c] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {generating ? "Generating…" : "Generate new token"}
        </button>

        {newToken && (
          <div className="mt-6 border border-amber/40 bg-amber-dim rounded-md p-4">
            <p className="text-sm text-paper mb-3 font-medium">
              Copy this token now — you won&apos;t be able to see it again.
            </p>
            <div className="flex gap-2">
              <code className="flex-1 font-mono text-xs bg-ink-raised border border-hairline-strong rounded-md px-3 py-2.5 text-paper break-all">
                {newToken}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className="shrink-0 text-sm font-medium px-3 py-2 bg-panel-raised border border-hairline-strong text-paper rounded-md inline-flex items-center gap-1.5 hover:border-fog"
              >
                <Copy size={14} />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="border border-hairline-strong bg-panel rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-hairline font-mono text-[0.6875rem] uppercase tracking-widest text-fog">
          Your tokens
        </div>
        {loading ? (
          <div className="px-5 py-8 text-sm text-fog">Loading tokens…</div>
        ) : tokens.length === 0 ? (
          <div className="px-5 py-8 text-sm text-fog-dim">No tokens yet.</div>
        ) : (
          <ul>
            {tokens.map((token) => (
              <li
                key={token.id}
                className="px-5 py-4 border-b border-hairline last:border-b-0 flex items-start justify-between gap-4"
              >
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-paper text-sm font-medium">{token.name}</span>
                  <span className="text-fog-dim text-xs font-mono">
                    Created {formatDate(token.createdAt)} · Last used {formatDate(token.lastUsedAt)}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={revokingId === token.id}
                  onClick={() => handleRevoke(token.id)}
                  className="shrink-0 text-sm font-medium px-3 py-1.5 bg-panel-raised border border-hairline-strong text-ember rounded-md inline-flex items-center gap-1.5 hover:border-ember disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Trash2 size={14} />
                  {revokingId === token.id ? "Revoking…" : "Revoke"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
