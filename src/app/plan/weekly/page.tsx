"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import PlanGenerator from "@/components/PlanGenerator";
import { createClient } from "@/lib/supabase/client";
import {
  ScheduleEntry,
  nextMonday,
  scheduleToText,
} from "@/lib/plans/schedule";

export default function WeeklyPlanPage() {
  const [weekStarting, setWeekStarting] = useState(nextMonday());
  const [schedule, setSchedule] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("schedule_template")
        .select("day_of_week, activity, start_time, duration_minutes")
        .order("day_of_week");
      if (cancelled) return;
      setSchedule(scheduleToText((data as ScheduleEntry[]) ?? []));
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-dvh bg-background">
      <div className="max-w-md mx-auto px-4 py-6">
        <AppHeader historyCount={0} showHistoryLink={false} />

        <Link
          href="/plans"
          className="text-xs text-muted hover:text-foreground transition-colors"
        >
          ← Plans
        </Link>

        <h2 className="text-2xl font-bold text-foreground mt-2 mb-1">
          Weekly plan
        </h2>
        <p className="text-sm text-muted mb-6">
          A week of fuelling built around what he&apos;s actually doing each day.
        </p>

        <PlanGenerator
          type="weekly"
          disabled={!loaded}
          payload={{ weekStarting, schedule }}
        >
          <div className="bg-card border border-card-border rounded-xl p-4 space-y-3">
            <label className="block">
              <span className="text-xs text-muted block mb-1">
                Week starting
              </span>
              <input
                type="date"
                value={weekStarting}
                onChange={(e) => setWeekStarting(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-sm text-foreground focus:outline-none focus:border-accent"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-foreground">
                This week&apos;s schedule
              </span>
              <span className="block text-xs text-muted mt-0.5 mb-2">
                Pre-filled from your typical week. Edit it for this week —
                cancelled practices, an extra game, a tournament.
              </span>
              <textarea
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                rows={8}
                className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-sm text-foreground font-mono focus:outline-none focus:border-accent"
              />
            </label>
          </div>
        </PlanGenerator>
      </div>
    </div>
  );
}
