"use client";

import { useState } from "react";

interface Props {
  label: string;
  hint?: string;
  values: string[];
  onChange: (values: string[]) => void;
  /** Styles the chips as a warning — used for allergies. */
  emphasis?: boolean;
  placeholder?: string;
}

export default function ChipListInput({
  label,
  hint,
  values,
  onChange,
  emphasis = false,
  placeholder = "Add and press Enter",
}: Props) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    // Case-insensitive dedupe: "Peanuts" and "peanuts" are the same allergy.
    if (values.some((v) => v.toLowerCase() === trimmed.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...values, trimmed]);
    setDraft("");
  };

  const chipClass = emphasis
    ? "bg-red-500/15 border-red-500/40 text-red-200"
    : "bg-background border-card-border text-foreground";

  return (
    <div className="bg-card border border-card-border rounded-xl p-4">
      <label className="block">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {hint && <span className="block text-xs text-muted mt-0.5">{hint}</span>}
      </label>

      {values.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {values.map((v) => (
            <span
              key={v}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm border ${chipClass}`}
            >
              {v}
              <button
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="ml-0.5 text-muted hover:text-red-400 transition-colors"
                aria-label={`Remove ${v}`}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2 mt-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 bg-background border border-card-border rounded-lg text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
        />
        <button
          onClick={add}
          disabled={!draft.trim()}
          className="px-4 py-2 bg-accent text-background rounded-lg text-sm font-medium disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  );
}
