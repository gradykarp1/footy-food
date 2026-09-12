"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import ChipListInput from "@/components/ChipListInput";
import { createClient } from "@/lib/supabase/client";

interface Preferences {
  version: number;
  likes: string[];
  dislikes: string[];
  allergies: string[];
  aversions: string[];
  cuisines: string[];
  notes: string | null;
  created_at: string;
}

const EMPTY: Preferences = {
  version: 0,
  likes: [],
  dislikes: [],
  allergies: [],
  aversions: [],
  cuisines: [],
  notes: "",
  created_at: "",
};

export default function PreferencesPage() {
  const [current, setCurrent] = useState<Preferences>(EMPTY);
  const [draft, setDraft] = useState<Preferences>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("preferences")
        .select("*")
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      const loaded = (data as Preferences) ?? EMPTY;
      setCurrent(loaded);
      setDraft({ ...loaded, notes: loaded.notes ?? "" });
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Saving writes a NEW version rather than mutating, so plans stay explicable. */
  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      const supabase = createClient();
      const nextVersion = (current.version ?? 0) + 1;
      const { data, error: insErr } = await supabase
        .from("preferences")
        .insert({
          version: nextVersion,
          likes: draft.likes,
          dislikes: draft.dislikes,
          allergies: draft.allergies,
          aversions: draft.aversions,
          cuisines: draft.cuisines,
          notes: draft.notes?.trim() || null,
        })
        .select("*")
        .single();
      if (insErr) throw new Error(insErr.message);
      setCurrent(data as Preferences);
      setSaved(`Saved as version ${nextVersion}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background">
      <div className="max-w-md mx-auto px-4 py-6">
        <AppHeader historyCount={0} showHistoryLink={false} />

        <Link
          href="/settings"
          className="text-xs text-muted hover:text-foreground transition-colors"
        >
          ← Settings
        </Link>

        <h2 className="text-2xl font-bold text-foreground mt-2">Preferences</h2>
        <p className="text-sm text-muted mb-6">
          {current.version > 0
            ? `Version ${current.version}. Saving creates a new version; plans record which one they used.`
            : "Not set yet. Plans and recipes are built around these."}
        </p>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <ChipListInput
              label="Allergies"
              hint="Never included in any plan or recipe."
              emphasis
              values={draft.allergies}
              onChange={(allergies) => setDraft({ ...draft, allergies })}
              placeholder="e.g. peanuts"
            />
            <ChipListInput
              label="Foods they love"
              hint="Favoured when there's a choice."
              values={draft.likes}
              onChange={(likes) => setDraft({ ...draft, likes })}
            />
            <ChipListInput
              label="Foods they won't eat"
              hint="Avoided, but not a safety issue."
              values={draft.dislikes}
              onChange={(dislikes) => setDraft({ ...draft, dislikes })}
            />
            <ChipListInput
              label="Textures and preparations to avoid"
              hint="e.g. mushy, very spicy, anything with sauce on it."
              values={draft.aversions}
              onChange={(aversions) => setDraft({ ...draft, aversions })}
            />
            <ChipListInput
              label="Cuisines they enjoy"
              values={draft.cuisines}
              onChange={(cuisines) => setDraft({ ...draft, cuisines })}
              placeholder="e.g. Mexican"
            />

            <div className="bg-card border border-card-border rounded-xl p-4">
              <label className="block">
                <span className="text-sm font-medium text-foreground">
                  Anything else
                </span>
                <span className="block text-xs text-muted mt-0.5">
                  Appetite before games, school lunch constraints, who cooks on
                  weeknights.
                </span>
                <textarea
                  value={draft.notes ?? ""}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                  rows={4}
                  className="w-full mt-3 px-3 py-2 bg-background border border-card-border rounded-lg text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
                  placeholder="Free text — this goes to the model as-is."
                />
              </label>
            </div>

            {saved && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3">
                <p className="text-green-300 text-sm">{saved}</p>
              </div>
            )}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                <p className="text-red-400 text-sm break-words">{error}</p>
              </div>
            )}

            <button
              onClick={save}
              disabled={saving}
              className="w-full py-3 bg-accent text-background rounded-xl font-medium disabled:opacity-50 hover:bg-accent-muted transition-colors"
            >
              {saving
                ? "Saving..."
                : `Save as version ${(current.version ?? 0) + 1}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
