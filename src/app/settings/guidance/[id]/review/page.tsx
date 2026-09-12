"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import RuleEditor, { EditableRule } from "@/components/RuleEditor";
import { createClient } from "@/lib/supabase/client";

interface Option {
  id: string;
  slot: string;
  category: string | null;
  food: string;
}

interface LowConfidence {
  id: string;
  page: number;
  reason: string;
}

/**
 * Two rules clash only if they describe the same nutrient at the same moment
 * AND their time windows overlap. Without the overlap test a hydration
 * schedule — 12-20oz at 2-3 hours, 4-8oz at 15 minutes — reads as a pile of
 * contradictions rather than a plan.
 */
function clashes(a: EditableRule, b: EditableRule): boolean {
  if (a.id === b.id) return false;
  if (
    a.nutrient !== b.nutrient ||
    a.anchor !== b.anchor ||
    a.direction !== b.direction ||
    a.condition !== b.condition
  )
    return false;

  const bothUntimed =
    a.offset_min_minutes === null && b.offset_min_minutes === null;
  const overlap =
    a.offset_min_minutes !== null &&
    b.offset_min_minutes !== null &&
    a.offset_min_minutes <= (b.offset_max_minutes ?? b.offset_min_minutes) &&
    b.offset_min_minutes <= (a.offset_max_minutes ?? a.offset_min_minutes);
  if (!bothUntimed && !overlap) return false;

  return (
    a.value_min !== b.value_min ||
    a.value_max !== b.value_max ||
    a.unit !== b.unit
  );
}

export default function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [filename, setFilename] = useState("");
  const [rules, setRules] = useState<EditableRule[]>([]);
  const [allRules, setAllRules] = useState<EditableRule[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [lowConf, setLowConf] = useState<LowConfidence[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createClient();
      const [doc, mine, every, o, l] = await Promise.all([
        supabase.from("guidance_documents").select("filename").eq("id", id).single(),
        supabase.from("extracted_rules").select("*").eq("document_id", id).order("source_page"),
        // Every rule, so clashes are detected across documents too.
        supabase.from("extracted_rules").select("*"),
        supabase.from("extracted_options").select("*").eq("document_id", id),
        supabase.from("low_confidence_pages").select("*").eq("document_id", id).order("page"),
      ]);

      if (cancelled) return;
      setFilename(doc.data?.filename ?? "");
      setRules((mine.data as EditableRule[]) ?? []);
      setAllRules((every.data as EditableRule[]) ?? []);
      setOptions((o.data as Option[]) ?? []);
      setLowConf((l.data as LowConfidence[]) ?? []);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const onChanged = (updated: EditableRule) => {
    setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setAllRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  };

  const approveAllPending = async () => {
    const supabase = createClient();
    const pending = rules.filter((r) => r.status === "pending").map((r) => r.id);
    if (pending.length === 0) return;
    await supabase
      .from("extracted_rules")
      .update({ status: "approved" })
      .in("id", pending);
    setRules((prev) =>
      prev.map((r) =>
        pending.includes(r.id) ? { ...r, status: "approved" } : r
      )
    );
  };

  const counts = {
    pending: rules.filter((r) => r.status === "pending").length,
    approved: rules.filter((r) => r.status === "approved").length,
    rejected: rules.filter((r) => r.status === "rejected").length,
  };

  const slots = Array.from(new Set(options.map((o) => o.slot)));

  return (
    <div className="min-h-dvh bg-background">
      <div className="max-w-md mx-auto px-4 py-6">
        <AppHeader historyCount={0} showHistoryLink={false} />

        <Link
          href="/settings/guidance"
          className="text-xs text-muted hover:text-foreground transition-colors"
        >
          ← All documents
        </Link>

        <h2 className="text-xl font-bold text-foreground mt-2 mb-1 break-words">
          {filename}
        </h2>
        <p className="text-sm text-muted mb-4">
          {counts.approved} approved · {counts.pending} pending ·{" "}
          {counts.rejected} rejected
        </p>

        {counts.pending > 0 && (
          <button
            onClick={approveAllPending}
            className="w-full py-2 mb-4 bg-card border border-card-border rounded-xl text-sm text-foreground hover:border-accent/50 transition-colors"
          >
            Approve all {counts.pending} pending in this document
          </button>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {lowConf.length > 0 && (
              <section className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                <h3 className="text-sm font-medium text-yellow-300 mb-2">
                  {lowConf.length} page{lowConf.length !== 1 ? "s" : ""} worth
                  checking against the original
                </h3>
                {lowConf.map((p) => (
                  <p key={p.id} className="text-xs text-foreground/80 mb-1">
                    <span className="font-medium">Page {p.page}:</span> {p.reason}
                  </p>
                ))}
              </section>
            )}

            <section>
              <h3 className="text-sm font-medium text-muted mb-3">
                Rules ({rules.length})
              </h3>
              <div className="space-y-2">
                {rules.map((r) => (
                  <RuleEditor
                    key={r.id}
                    rule={r}
                    clashesWith={allRules.filter((o) => clashes(r, o))}
                    onChanged={onChanged}
                  />
                ))}
              </div>
            </section>

            {slots.length > 0 && (
              <section>
                <h3 className="text-sm font-medium text-muted mb-3">
                  Food options ({options.length})
                </h3>
                <div className="space-y-3">
                  {slots.map((slot) => (
                    <div
                      key={slot}
                      className="bg-card border border-card-border rounded-xl p-3"
                    >
                      <p className="text-sm font-medium text-foreground mb-2">
                        {slot}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {options
                          .filter((o) => o.slot === slot)
                          .map((o) => (
                            <span
                              key={o.id}
                              className="text-xs px-2 py-0.5 rounded-full bg-background text-foreground/80"
                            >
                              {o.food}
                            </span>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
