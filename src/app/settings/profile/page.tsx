"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/client";

interface Profile {
  id?: string;
  name: string;
  birthdate: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  position: string | null;
  notes: string | null;
}

interface ScheduleEntry {
  id: string;
  day_of_week: number;
  activity: string;
  start_time: string | null;
  duration_minutes: number | null;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ACTIVITIES = ["practice", "game", "rest", "other"];

// Weight and height are always STORED in kg and cm: the guidance is written in
// per-kilogram terms and resolving those against a converted number would put a
// rounding step between the rule and the plan. Imperial is a display choice
// only, converted at the input boundary.
const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;
const UNITS_KEY = "footy-food-units";

type UnitSystem = "metric" | "imperial";

const round1 = (n: number) => Math.round(n * 10) / 10;

function toDisplayWeight(kg: number | null, units: UnitSystem): string {
  if (kg === null) return "";
  return units === "metric" ? String(round1(kg)) : String(round1(kg / KG_PER_LB));
}

function toDisplayHeight(cm: number | null, units: UnitSystem): string {
  if (cm === null) return "";
  return units === "metric" ? String(round1(cm)) : String(round1(cm / CM_PER_IN));
}

const EMPTY: Profile = {
  name: "",
  birthdate: null,
  weight_kg: null,
  height_cm: null,
  position: null,
  notes: null,
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [units, setUnits] = useState<UnitSystem>("metric");
  // Input strings are held separately from the canonical profile so that
  // switching units never round-trips a stored value through two conversions.
  const [weightInput, setWeightInput] = useState("");
  const [heightInput, setHeightInput] = useState("");

  useEffect(() => {
    let cancelled = false;
    const stored = localStorage.getItem(UNITS_KEY);
    const startUnits: UnitSystem = stored === "imperial" ? "imperial" : "metric";
    setUnits(startUnits);

    (async () => {
      const supabase = createClient();
      const [p, s] = await Promise.all([
        supabase.from("athlete_profile").select("*").limit(1).maybeSingle(),
        supabase.from("schedule_template").select("*").order("day_of_week"),
      ]);
      if (cancelled) return;
      if (p.data) {
        const loaded = p.data as Profile;
        setProfile(loaded);
        setWeightInput(toDisplayWeight(loaded.weight_kg, startUnits));
        setHeightInput(toDisplayHeight(loaded.height_cm, startUnits));
      }
      setSchedule((s.data as ScheduleEntry[]) ?? []);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Re-renders the inputs in the new unit. Canonical values are untouched. */
  const switchUnits = (next: UnitSystem) => {
    setUnits(next);
    localStorage.setItem(UNITS_KEY, next);
    setWeightInput(toDisplayWeight(profile.weight_kg, next));
    setHeightInput(toDisplayHeight(profile.height_cm, next));
  };

  const onWeightChange = (raw: string) => {
    setWeightInput(raw);
    const n = raw === "" ? null : Number(raw);
    setProfile({
      ...profile,
      weight_kg:
        n === null || Number.isNaN(n)
          ? null
          : units === "metric"
            ? n
            : round1(n * KG_PER_LB * 100) / 100,
    });
  };

  const onHeightChange = (raw: string) => {
    setHeightInput(raw);
    const n = raw === "" ? null : Number(raw);
    setProfile({
      ...profile,
      height_cm:
        n === null || Number.isNaN(n)
          ? null
          : units === "metric"
            ? n
            : Math.round(n * CM_PER_IN * 10) / 10,
    });
  };

  const saveProfile = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const supabase = createClient();
      const payload = {
        name: profile.name.trim(),
        birthdate: profile.birthdate || null,
        weight_kg: profile.weight_kg,
        height_cm: profile.height_cm,
        position: profile.position?.trim() || null,
        notes: profile.notes?.trim() || null,
      };
      const { data, error: err } = profile.id
        ? await supabase
            .from("athlete_profile")
            .update(payload)
            .eq("id", profile.id)
            .select("*")
            .single()
        : await supabase
            .from("athlete_profile")
            .insert(payload)
            .select("*")
            .single();
      if (err) throw new Error(err.message);
      setProfile(data as Profile);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const addEntry = async (day: number) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("schedule_template")
      .insert({ day_of_week: day, activity: "practice", duration_minutes: 90 })
      .select("*")
      .single();
    if (data) setSchedule((prev) => [...prev, data as ScheduleEntry]);
  };

  const updateEntry = async (id: string, patch: Partial<ScheduleEntry>) => {
    setSchedule((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...patch } : e))
    );
    const supabase = createClient();
    await supabase.from("schedule_template").update(patch).eq("id", id);
  };

  const removeEntry = async (id: string) => {
    setSchedule((prev) => prev.filter((e) => e.id !== id));
    const supabase = createClient();
    await supabase.from("schedule_template").delete().eq("id", id);
  };

  const field =
    "w-full px-3 py-2 bg-background border border-card-border rounded-lg text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent";

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

        <h2 className="text-2xl font-bold text-foreground mt-2 mb-6">
          Athlete profile
        </h2>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-card border border-card-border rounded-xl p-4 space-y-3">
              <label className="block">
                <span className="text-xs text-muted block mb-1">Name</span>
                <input
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className={field}
                />
              </label>

              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">Units</span>
                <div className="flex rounded-lg overflow-hidden border border-card-border">
                  {(
                    [
                      ["imperial", "lb / in"],
                      ["metric", "kg / cm"],
                    ] as [UnitSystem, string][]
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => switchUnits(value)}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                        units === value
                          ? "bg-accent text-background"
                          : "bg-background text-muted hover:text-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <label className="flex-1">
                  <span className="text-xs text-muted block mb-1">
                    Weight ({units === "metric" ? "kg" : "lb"})
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    value={weightInput}
                    onChange={(e) => onWeightChange(e.target.value)}
                    className={field}
                  />
                </label>
                <label className="flex-1">
                  <span className="text-xs text-muted block mb-1">
                    Height ({units === "metric" ? "cm" : "in"})
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    value={heightInput}
                    onChange={(e) => onHeightChange(e.target.value)}
                    className={field}
                  />
                </label>
              </div>

              <p className="text-xs text-muted">
                Weight drives every per-kilogram rule in the guidance, so keep it
                current as he grows. Plans record the weight they were built
                against.
                {units === "imperial" && profile.weight_kg !== null && (
                  <> Stored as {round1(profile.weight_kg)} kg.</>
                )}
              </p>

              <div className="flex gap-2">
                <label className="flex-1">
                  <span className="text-xs text-muted block mb-1">Birthdate</span>
                  <input
                    type="date"
                    value={profile.birthdate ?? ""}
                    onChange={(e) =>
                      setProfile({ ...profile, birthdate: e.target.value || null })
                    }
                    className={field}
                  />
                </label>
                <label className="flex-1">
                  <span className="text-xs text-muted block mb-1">Position</span>
                  <input
                    value={profile.position ?? ""}
                    onChange={(e) =>
                      setProfile({ ...profile, position: e.target.value })
                    }
                    placeholder="e.g. midfielder"
                    className={field}
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-xs text-muted block mb-1">Notes</span>
                <textarea
                  value={profile.notes ?? ""}
                  onChange={(e) => setProfile({ ...profile, notes: e.target.value })}
                  rows={3}
                  className={field}
                  placeholder="Growth spurts, injuries, anything affecting fuelling."
                />
              </label>
            </div>

            {saved && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3">
                <p className="text-green-300 text-sm">Profile saved.</p>
              </div>
            )}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                <p className="text-red-400 text-sm break-words">{error}</p>
              </div>
            )}

            <button
              onClick={saveProfile}
              disabled={saving || !profile.name.trim()}
              className="w-full py-3 bg-accent text-background rounded-xl font-medium disabled:opacity-50 hover:bg-accent-muted transition-colors"
            >
              {saving ? "Saving..." : "Save profile"}
            </button>

            <div className="pt-4">
              <h3 className="text-sm font-medium text-foreground">
                Typical week
              </h3>
              <p className="text-xs text-muted mt-0.5 mb-3">
                A default pattern, not a fixture list — you can adjust any
                individual week when generating a plan. Times use your device
                clock, so they show as AM/PM here and are stored on a 24-hour
                clock.
              </p>

              <div className="space-y-2">
                {DAYS.map((day, index) => {
                  const entries = schedule.filter((e) => e.day_of_week === index);
                  return (
                    <div
                      key={day}
                      className="bg-card border border-card-border rounded-xl p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">
                          {day}
                        </span>
                        <button
                          onClick={() => addEntry(index)}
                          className="text-xs text-accent hover:text-accent-muted transition-colors"
                        >
                          + Add
                        </button>
                      </div>

                      {entries.length === 0 ? (
                        <p className="text-xs text-muted mt-1">Rest day</p>
                      ) : (
                        <div className="space-y-2 mt-2">
                          {entries.map((e) => (
                            <div
                              key={e.id}
                              className="bg-background border border-card-border rounded-lg p-2.5 space-y-2"
                            >
                              <div className="flex gap-2 items-center">
                                <label className="flex-1">
                                  <span className="text-[11px] text-muted block mb-1">
                                    Activity
                                  </span>
                                  <select
                                    value={e.activity}
                                    onChange={(ev) =>
                                      updateEntry(e.id, {
                                        activity: ev.target.value,
                                      })
                                    }
                                    className="w-full px-2 py-1.5 bg-card border border-card-border rounded-lg text-sm text-foreground capitalize"
                                  >
                                    {ACTIVITIES.map((a) => (
                                      <option key={a} value={a}>
                                        {a}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <button
                                  onClick={() => removeEntry(e.id)}
                                  className="self-end px-2 py-1.5 text-muted hover:text-red-400 transition-colors text-sm"
                                  aria-label={`Remove ${e.activity} on ${DAYS[e.day_of_week]}`}
                                >
                                  Remove
                                </button>
                              </div>

                              <div className="flex gap-2">
                                <label className="flex-1">
                                  <span className="text-[11px] text-muted block mb-1">
                                    Start time
                                  </span>
                                  <input
                                    type="time"
                                    value={e.start_time?.slice(0, 5) ?? ""}
                                    onChange={(ev) =>
                                      updateEntry(e.id, {
                                        start_time: ev.target.value || null,
                                      })
                                    }
                                    className="w-full px-2 py-1.5 bg-card border border-card-border rounded-lg text-sm text-foreground"
                                  />
                                </label>
                                <label className="flex-1">
                                  <span className="text-[11px] text-muted block mb-1">
                                    Length (minutes)
                                  </span>
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    min={0}
                                    step={5}
                                    value={e.duration_minutes ?? ""}
                                    onChange={(ev) =>
                                      updateEntry(e.id, {
                                        duration_minutes:
                                          ev.target.value === ""
                                            ? null
                                            : Number(ev.target.value),
                                      })
                                    }
                                    placeholder="90"
                                    className="w-full px-2 py-1.5 bg-card border border-card-border rounded-lg text-sm text-foreground placeholder:text-muted"
                                  />
                                </label>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
