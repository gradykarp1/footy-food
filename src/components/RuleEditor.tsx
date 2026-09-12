"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface EditableRule {
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
  status: string;
  edited: boolean;
}

const CONDITIONS = ["any", "game_day", "training_day", "rest_day", "tournament"];

function timing(r: EditableRule): string {
  if (r.anchor === "none") return "any time";
  const off =
    r.offset_min_minutes === null
      ? ""
      : r.offset_min_minutes === r.offset_max_minutes
        ? `${r.offset_min_minutes}m `
        : `${r.offset_min_minutes}–${r.offset_max_minutes}m `;
  return `${off}${r.direction} ${r.anchor}`;
}

interface Props {
  rule: EditableRule;
  /** Other rules sharing this rule's conflict key, with overlapping windows. */
  clashesWith: EditableRule[];
  onChanged: (rule: EditableRule) => void;
}

export default function RuleEditor({ rule, clashesWith, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    value_min: rule.value_min?.toString() ?? "",
    value_max: rule.value_max?.toString() ?? "",
    unit: rule.unit ?? "",
    condition: rule.condition,
  });

  const isQualitative = rule.basis === "qualitative";

  const persist = async (patch: Partial<EditableRule>) => {
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("extracted_rules")
      .update(patch)
      .eq("id", rule.id)
      .select("*")
      .single();
    setSaving(false);
    if (!error && data) onChanged(data as EditableRule);
    return { error };
  };

  const saveEdits = async () => {
    // A qualitative rule carries no numbers — the database enforces this, so
    // send nulls rather than letting an empty string become 0.
    const patch: Partial<EditableRule> = {
      unit: draft.unit.trim() || null,
      condition: draft.condition,
      edited: true,
      value_min: isQualitative || draft.value_min === "" ? null : Number(draft.value_min),
      value_max: isQualitative || draft.value_max === "" ? null : Number(draft.value_max),
    };
    const { error } = await persist(patch);
    if (error) {
      alert(`Could not save: ${error.message}`);
      return;
    }
    setOpen(false);
  };

  const value = isQualitative
    ? "directional"
    : rule.value_min === null
      ? "—"
      : `${rule.value_min === rule.value_max ? rule.value_min : `${rule.value_min}–${rule.value_max}`}${rule.unit ? ` ${rule.unit}` : ""}`;

  const border =
    rule.status === "approved"
      ? "border-green-500/40"
      : rule.status === "rejected"
        ? "border-red-500/30 opacity-50"
        : "border-card-border";

  return (
    <div className={`bg-card border rounded-xl p-3 ${border}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium text-foreground text-sm">
          {rule.nutrient.replace(/_/g, " ")}
        </span>
        <span className="text-accent text-sm font-medium">{value}</span>
      </div>

      <p className="text-xs text-muted mt-1">
        {timing(rule)}
        {rule.condition !== "any" && ` · ${rule.condition.replace(/_/g, " ")}`}
        {rule.source_page && ` · p${rule.source_page}`}
        {rule.edited && " · edited"}
      </p>

      {clashesWith.length > 0 && (
        <p className="text-xs text-yellow-300 mt-2">
          Overlaps {clashesWith.length} other rule
          {clashesWith.length !== 1 ? "s" : ""} for the same nutrient and moment:{" "}
          {clashesWith
            .map((c) =>
              c.value_min === null
                ? "directional"
                : `${c.value_min}–${c.value_max}${c.unit ? ` ${c.unit}` : ""}`
            )
            .join(", ")}
        </p>
      )}

      <p className="text-xs text-foreground/60 mt-2 italic whitespace-pre-wrap break-words border-l-2 border-card-border pl-2">
        {rule.verbatim_quote}
      </p>

      {open && (
        <div className="mt-3 space-y-2 border-t border-card-border pt-3">
          {!isQualitative && (
            <div className="flex gap-2">
              <label className="flex-1">
                <span className="text-xs text-muted block mb-1">Min</span>
                <input
                  type="number"
                  value={draft.value_min}
                  onChange={(e) =>
                    setDraft({ ...draft, value_min: e.target.value })
                  }
                  className="w-full px-2 py-1.5 bg-background border border-card-border rounded-lg text-sm text-foreground"
                />
              </label>
              <label className="flex-1">
                <span className="text-xs text-muted block mb-1">Max</span>
                <input
                  type="number"
                  value={draft.value_max}
                  onChange={(e) =>
                    setDraft({ ...draft, value_max: e.target.value })
                  }
                  className="w-full px-2 py-1.5 bg-background border border-card-border rounded-lg text-sm text-foreground"
                />
              </label>
              <label className="flex-1">
                <span className="text-xs text-muted block mb-1">Unit</span>
                <input
                  value={draft.unit}
                  onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                  placeholder="g, oz, %"
                  className="w-full px-2 py-1.5 bg-background border border-card-border rounded-lg text-sm text-foreground placeholder:text-muted"
                />
              </label>
            </div>
          )}

          <label className="block">
            <span className="text-xs text-muted block mb-1">Applies on</span>
            <select
              value={draft.condition}
              onChange={(e) =>
                setDraft({ ...draft, condition: e.target.value })
              }
              className="w-full px-2 py-1.5 bg-background border border-card-border rounded-lg text-sm text-foreground"
            >
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>

          <button
            onClick={saveEdits}
            disabled={saving}
            className="w-full py-2 bg-accent text-background rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      )}

      <div className="flex gap-2 mt-3">
        <button
          onClick={() => persist({ status: "approved" })}
          disabled={saving || rule.status === "approved"}
          className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-green-500/15 text-green-300 border border-green-500/30 disabled:opacity-40"
        >
          {rule.status === "approved" ? "Approved" : "Approve"}
        </button>
        <button
          onClick={() => persist({ status: "rejected" })}
          disabled={saving || rule.status === "rejected"}
          className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-300 border border-red-500/30 disabled:opacity-40"
        >
          {rule.status === "rejected" ? "Rejected" : "Reject"}
        </button>
        <button
          onClick={() => setOpen(!open)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-background border border-card-border text-foreground"
        >
          {open ? "Close" : "Edit"}
        </button>
      </div>
    </div>
  );
}
