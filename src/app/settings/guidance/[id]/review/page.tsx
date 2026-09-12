"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/client";

interface Rule {
  id: string;
  kind: string;
  nutrient: string;
  value_min: number | null;
  value_max: number | null;
  unit: string | null;
  basis: string;
  anchor: string;
  direction: string;
  offset_min_minutes: number | null;
  offset_max_minutes: number | null;
  condition: string;
  source_page: number | null;
  verbatim_quote: string;
}

interface Option {
  id: string;
  slot: string;
  category: string | null;
  food: string;
  source_page: number | null;
}

interface Context {
  id: string;
  section_title: string | null;
  body: string;
  source_page: number | null;
}

interface LowConfidence {
  id: string;
  page: number;
  reason: string;
}

function describeValue(r: Rule): string {
  if (r.basis === "qualitative" || r.value_min === null) return "directional";
  const v =
    r.value_min === r.value_max
      ? `${r.value_min}`
      : `${r.value_min}–${r.value_max}`;
  return r.unit ? `${v} ${r.unit}` : v;
}

function describeTiming(r: Rule): string {
  if (r.anchor === "none") return "any time";
  const off =
    r.offset_min_minutes === null
      ? ""
      : r.offset_min_minutes === r.offset_max_minutes
        ? `${r.offset_min_minutes}m `
        : `${r.offset_min_minutes}–${r.offset_max_minutes}m `;
  return `${off}${r.direction} ${r.anchor}`;
}

export default function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [filename, setFilename] = useState<string>("");
  const [rules, setRules] = useState<Rule[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [context, setContext] = useState<Context[]>([]);
  const [lowConf, setLowConf] = useState<LowConfidence[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Guarded so a fast navigation away can't set state on an unmounted view.
    let cancelled = false;

    (async () => {
      const supabase = createClient();
      const [doc, r, o, c, l] = await Promise.all([
      supabase.from("guidance_documents").select("filename").eq("id", id).single(),
      supabase
        .from("extracted_rules")
        .select("*")
        .eq("document_id", id)
        .order("source_page"),
      supabase
        .from("extracted_options")
        .select("*")
        .eq("document_id", id)
        .order("source_page"),
      supabase
        .from("extracted_context")
        .select("*")
        .eq("document_id", id)
        .order("source_page"),
      supabase
        .from("low_confidence_pages")
        .select("*")
        .eq("document_id", id)
        .order("page"),
      ]);

      if (cancelled) return;
      setFilename(doc.data?.filename ?? "");
      setRules((r.data as Rule[]) ?? []);
      setOptions((o.data as Option[]) ?? []);
      setContext((c.data as Context[]) ?? []);
      setLowConf((l.data as LowConfidence[]) ?? []);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

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
        <p className="text-sm text-muted mb-6">
          {rules.length} rules · {options.length} food options ·{" "}
          {context.length} context sections
        </p>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {lowConf.length > 0 && (
              <section className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                <h3 className="text-sm font-medium text-yellow-300 mb-2">
                  {lowConf.length} page{lowConf.length !== 1 ? "s" : ""} need a
                  visual re-read
                </h3>
                <p className="text-xs text-muted mb-3">
                  Figures on these pages did not survive text extraction. Nothing
                  was guessed — they are queued to be re-read as images.
                </p>
                {lowConf.map((p) => (
                  <p key={p.id} className="text-xs text-foreground/80 mb-1">
                    <span className="font-medium">Page {p.page}:</span>{" "}
                    {p.reason}
                  </p>
                ))}
              </section>
            )}

            <section>
              <h3 className="text-sm font-medium text-muted mb-3">Rules</h3>
              {rules.length === 0 ? (
                <p className="text-sm text-muted">
                  Nothing extracted yet. Run extraction first.
                </p>
              ) : (
                <div className="space-y-2">
                  {rules.map((r) => (
                    <div
                      key={r.id}
                      className="bg-card border border-card-border rounded-xl p-3"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium text-foreground text-sm">
                          {r.nutrient.replace(/_/g, " ")}
                        </span>
                        <span className="text-accent text-sm font-medium">
                          {describeValue(r)}
                        </span>
                      </div>
                      <p className="text-xs text-muted mt-1">
                        {describeTiming(r)}
                        {r.condition !== "any" && ` · ${r.condition.replace(/_/g, " ")}`}
                        {r.basis !== "qualitative" && ` · ${r.basis.replace(/_/g, " ")}`}
                        {r.source_page && ` · p${r.source_page}`}
                      </p>
                      <p className="text-xs text-foreground/60 mt-2 italic whitespace-pre-wrap break-words border-l-2 border-card-border pl-2">
                        {r.verbatim_quote}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {slots.length > 0 && (
              <section>
                <h3 className="text-sm font-medium text-muted mb-3">
                  Food options
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
                              {o.category && (
                                <span className="text-muted"> · {o.category}</span>
                              )}
                            </span>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {context.length > 0 && (
              <section>
                <h3 className="text-sm font-medium text-muted mb-3">Context</h3>
                <div className="space-y-2">
                  {context.map((c) => (
                    <div
                      key={c.id}
                      className="bg-card border border-card-border rounded-xl p-3"
                    >
                      <p className="text-sm font-medium text-foreground">
                        {c.section_title ?? "Untitled"}
                        {c.source_page && (
                          <span className="text-muted font-normal text-xs">
                            {" "}
                            · p{c.source_page}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-foreground/70 mt-1 whitespace-pre-wrap break-words">
                        {c.body}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <p className="text-xs text-muted text-center pt-2">
              Read-only for now. Editing, merge suggestions and conflict
              resolution are the next step.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
