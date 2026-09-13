"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/client";
import {
  MergeGroup,
  MergeableRule,
  describeValue,
  describeWindow,
  proposeMerges,
} from "@/lib/guidance/rationalize";

export default function RationalizePage() {
  const [rules, setRules] = useState<MergeableRule[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [docNames, setDocNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const [r, d, docs] = await Promise.all([
        supabase.from("extracted_rules").select("*"),
        supabase.from("rule_merge_dismissals").select("group_key"),
        supabase.from("guidance_documents").select("id, filename"),
      ]);
      if (cancelled) return;
      setRules((r.data as MergeableRule[]) ?? []);
      setDismissed(
        new Set(((d.data as { group_key: string }[]) ?? []).map((x) => x.group_key))
      );
      setDocNames(
        Object.fromEntries(
          ((docs.data as { id: string; filename: string }[]) ?? []).map((x) => [
            x.id,
            x.filename.replace(/\.pdf$/i, ""),
          ])
        )
      );
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const groups = proposeMerges(rules, dismissed);
  const approvedCount = rules.filter((r) => r.status === "approved").length;
  const wouldRemove = groups.reduce((n, g) => n + g.duplicates.length, 0);

  const merge = async (group: MergeGroup) => {
    setBusyKey(group.key);
    setError(null);
    try {
      const supabase = createClient();
      const ids = group.duplicates.map((d) => d.id);
      const { error: err } = await supabase
        .from("extracted_rules")
        .update({ status: "merged", merged_into: group.keeper.id })
        .in("id", ids);
      if (err) throw new Error(err.message);

      // Merged rules keep their quote and provenance; they are simply no longer
      // published. Nothing is deleted, so a merge can be reasoned about later.
      setRules((prev) =>
        prev.map((r) =>
          ids.includes(r.id)
            ? { ...r, status: "merged" }
            : r
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not merge");
    } finally {
      setBusyKey(null);
    }
  };

  const decline = async (group: MergeGroup) => {
    setBusyKey(group.key);
    setError(null);
    try {
      const supabase = createClient();
      const { error: err } = await supabase
        .from("rule_merge_dismissals")
        .upsert({ group_key: group.key });
      if (err) throw new Error(err.message);
      setDismissed((prev) => new Set(prev).add(group.key));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not dismiss");
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="min-h-dvh bg-background">
      <div className="max-w-md mx-auto px-4 py-6">
        <AppHeader historyCount={0} showHistoryLink={false} />

        <Link
          href="/settings/guidance"
          className="text-xs text-muted hover:text-foreground transition-colors"
        >
          ← Guidance
        </Link>

        <h2 className="text-2xl font-bold text-foreground mt-2 mb-1">
          Rationalize rules
        </h2>
        <p className="text-sm text-muted mb-6">
          Your documents restate the same guidance in different words. Merging
          keeps one rule per moment and drops the repeats — fewer rules for
          plans to reason through, and nothing lost.
        </p>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="bg-card border border-card-border rounded-xl p-4 mb-4">
              <p className="text-sm text-foreground">
                <span className="font-medium">{approvedCount}</span> active
                rules
                {wouldRemove > 0 && (
                  <>
                    {" → "}
                    <span className="font-medium text-accent">
                      {approvedCount - wouldRemove}
                    </span>{" "}
                    if you accept all {groups.length} suggestion
                    {groups.length !== 1 ? "s" : ""}
                  </>
                )}
              </p>
              {wouldRemove > 0 && (
                <p className="text-xs text-muted mt-1">
                  Merged rules keep their quote and source page. They stop being
                  published, but nothing is deleted.
                </p>
              )}
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4">
                <p className="text-red-400 text-sm break-words">{error}</p>
              </div>
            )}

            {groups.length === 0 ? (
              <p className="text-sm text-muted text-center py-8">
                Nothing left to merge. Republish the ruleset on the Guidance
                screen to put your changes live.
              </p>
            ) : (
              <div className="space-y-4">
                {groups.map((g) => (
                  <div
                    key={g.key}
                    className="bg-card border border-card-border rounded-xl p-4"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium text-foreground text-sm">
                        {g.keeper.nutrient.replace(/_/g, " ")}
                      </span>
                      <span className="text-accent text-sm">
                        {describeValue(g.keeper)}
                      </span>
                    </div>
                    <p className="text-xs text-muted mt-0.5">
                      {describeWindow(g.keeper)} · {g.reason}
                      {g.confidence === "same moment" && " · differing scope"}
                    </p>

                    <p className="text-xs font-medium text-foreground/70 mt-3 mb-1">
                      Keep this one:
                    </p>
                    <div className="border-l-2 border-accent pl-2">
                      <p className="text-xs text-foreground/80 italic whitespace-pre-wrap break-words">
                        {g.keeper.verbatim_quote}
                      </p>
                      <p className="text-[11px] text-muted mt-0.5">
                        {docNames[g.keeper.document_id] ?? "unknown"}
                        {g.keeper.source_page && `, p${g.keeper.source_page}`}
                      </p>
                    </div>

                    <p className="text-xs font-medium text-foreground/70 mt-3 mb-1">
                      Drop {g.duplicates.length} repeat
                      {g.duplicates.length !== 1 ? "s" : ""}:
                    </p>
                    <div className="space-y-2">
                      {g.duplicates.map((d) => (
                        <div key={d.id} className="border-l-2 border-card-border pl-2">
                          <p className="text-xs text-foreground/60 italic whitespace-pre-wrap break-words">
                            {d.verbatim_quote}
                          </p>
                          <p className="text-[11px] text-muted mt-0.5">
                            {docNames[d.document_id] ?? "unknown"}
                            {d.source_page && `, p${d.source_page}`}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => merge(g)}
                        disabled={busyKey === g.key}
                        className="flex-1 py-2 bg-accent text-background rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-accent-muted transition-colors"
                      >
                        {busyKey === g.key ? "Merging..." : "Merge"}
                      </button>
                      <button
                        onClick={() => decline(g)}
                        disabled={busyKey === g.key}
                        className="flex-1 py-2 bg-background border border-card-border rounded-lg text-sm font-medium text-foreground disabled:opacity-50 hover:border-accent/50 transition-colors"
                      >
                        Not the same
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
