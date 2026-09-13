"use client";

import { useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import PlanGenerator from "@/components/PlanGenerator";

function nextSaturday(): string {
  const d = new Date();
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

export default function GameDayPlanPage() {
  const [date, setDate] = useState(nextSaturday());
  const [time, setTime] = useState("15:30");

  const field =
    "w-full px-3 py-2 bg-background border border-card-border rounded-lg text-sm text-foreground focus:outline-none focus:border-accent";

  const readable = new Date(`${date}T${time}`).toLocaleString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

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
          Game day plan
        </h2>
        <p className="text-sm text-muted mb-6">
          Everything timed around kickoff, from the meal hours before to
          recovery afterwards.
        </p>

        <PlanGenerator
          type="game_day"
          payload={{ kickoffTime: readable }}
        >
          <div className="bg-card border border-card-border rounded-xl p-4 space-y-3">
            <div className="flex gap-2">
              <label className="flex-1">
                <span className="text-xs text-muted block mb-1">Match date</span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={field}
                />
              </label>
              <label className="flex-1">
                <span className="text-xs text-muted block mb-1">Kickoff</span>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className={field}
                />
              </label>
            </div>
            <p className="text-xs text-muted">
              Planning for <span className="text-foreground">{readable}</span>.
              Every window is timed from this.
            </p>
          </div>
        </PlanGenerator>
      </div>
    </div>
  );
}
