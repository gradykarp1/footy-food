"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
      // Runs on Supabase Edge Functions, not Vercel. Measured at 50-95s
      // against the real ruleset, which a Vercel Hobby function (60s ceiling)
      // cannot hold open.
      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke(
        "generate-plan",
        { body: { type, notes: notes.trim() || undefined, ...payload } }
      );

      if (fnError) {
        // A non-2xx from an edge function arrives as an opaque error; the
        // useful message is in the response body.
        let detail = fnError.message;
        const ctx = (fnError as { context?: Response }).context;
        if (ctx && typeof ctx.json === "function") {
          try {
            const parsed = await ctx.json();
            if (parsed?.error) detail = parsed.error;
          } catch {
            // Body wasn't JSON — keep the original message.
          }
        }
        throw new Error(detail);
      }

      if (!data?.id) throw new Error("Plan was generated but not saved.");
      router.push(`/plans/${data.id}`);
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
