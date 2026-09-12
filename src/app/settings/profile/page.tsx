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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const [p, s] = await Promise.all([
        supabase.from("athlete_profile").select("*").limit(1).maybeSingle(),
        supabase.from("schedule_template").select("*").order("day_of_week"),
      ]);
      if (cancelled) return;
      if (p.data) setProfile(p.data as Profile);
      setSchedule((s.data as ScheduleEntry[]) ?? []);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

              <div className="flex gap-2">
                <label className="flex-1">
                  <span className="text-xs text-muted block mb-1">Weight (kg)</span>
                  <input
                    type="number"
                    step="0.1"
                    value={profile.weight_kg ?? ""}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        weight_kg: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    className={field}
                  />
                </label>
                <label className="flex-1">
                  <span className="text-xs text-muted block mb-1">Height (cm)</span>
                  <input
                    type="number"
                    value={profile.height_cm ?? ""}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        height_cm: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    className={field}
                  />
                </label>
              </div>

              <p className="text-xs text-muted">
                Weight drives every per-kilogram rule in the guidance, so keep it
                current as he grows. Plans record the weight they were built
                against.
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
                A default pattern, not a fixture list. You can adjust any
                individual week when generating a plan.
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
                            <div key={e.id} className="flex gap-2 items-center">
                              <select
                                value={e.activity}
                                onChange={(ev) =>
                                  updateEntry(e.id, { activity: ev.target.value })
                                }
                                className="flex-1 px-2 py-1.5 bg-background border border-card-border rounded-lg text-xs text-foreground"
                              >
                                {ACTIVITIES.map((a) => (
                                  <option key={a} value={a}>
                                    {a}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="time"
                                value={e.start_time?.slice(0, 5) ?? ""}
                                onChange={(ev) =>
                                  updateEntry(e.id, {
                                    start_time: ev.target.value || null,
                                  })
                                }
                                className="px-2 py-1.5 bg-background border border-card-border rounded-lg text-xs text-foreground"
                              />
                              <input
                                type="number"
                                value={e.duration_minutes ?? ""}
                                onChange={(ev) =>
                                  updateEntry(e.id, {
                                    duration_minutes:
                                      ev.target.value === ""
                                        ? null
                                        : Number(ev.target.value),
                                  })
                                }
                                placeholder="min"
                                className="w-16 px-2 py-1.5 bg-background border border-card-border rounded-lg text-xs text-foreground placeholder:text-muted"
                              />
                              <button
                                onClick={() => removeEntry(e.id)}
                                className="text-muted hover:text-red-400 transition-colors px-1"
                                aria-label="Remove"
                              >
                                ×
                              </button>
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
