"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  type: "game_day" | "weekly";
  /** Extra fields above the notes box — kickoff, or week + schedule. */
  children: React.ReactNode;
  payload: Record<string, unknown>;
  disabled?: boolean;
}

export default function PlanGenerator({
  type,
  children,
  payload,
  disabled,
}: Props) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/plans/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, notes: notes.trim() || undefined, ...payload }),
      });

      // High-effort planning can run long; a timeout arrives as an HTML error
      // page, which would otherwise surface as an unreadable parse error.
      const raw = await res.text();
      let body: { id?: string; error?: string };
      try {
        body = JSON.parse(raw);
      } catch {
        throw new Error(
          res.status === 504 || /timed out|TIMEOUT/i.test(raw)
            ? "Generation took longer than the server allows. Try again — plans are usually faster on a second attempt."
            : `Server returned ${res.status}. ${raw.slice(0, 200)}`
        );
      }

      if (!res.ok) throw new Error(body.error || "Could not generate the plan");
      router.push(`/plans/${body.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate the plan");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {children}

      <div className="bg-card border border-card-border rounded-xl p-4">
        <label className="block">
          <span className="text-sm font-medium text-foreground">
            Anything specific about this one?
          </span>
          <span className="block text-xs text-muted mt-0.5">
            Weather, a tournament, an away trip, how he&apos;s been feeling.
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Optional"
            className="w-full mt-3 px-3 py-2 bg-background border border-card-border rounded-lg text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
          />
        </label>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
          <p className="text-red-400 text-sm whitespace-pre-wrap break-words">
            {error}
          </p>
        </div>
      )}

      <button
        onClick={generate}
        disabled={busy || disabled}
        className="w-full py-3 bg-accent text-background rounded-xl font-medium disabled:opacity-50 hover:bg-accent-muted transition-colors flex items-center justify-center gap-2"
      >
        {busy ? (
          <>
            <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
            Building the plan...
          </>
        ) : (
          "Generate plan"
        )}
      </button>

      {busy && (
        <p className="text-xs text-muted text-center">
          This takes a while — it works through every rule in your guidance and
          then checks the result against them.
        </p>
      )}
    </div>
  );
}
