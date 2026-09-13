"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/client";

interface PlanRow {
  id: string;
  type: "game_day" | "weekly";
  title: string | null;
  created_at: string;
  validation: unknown[];
}

export default function PlansPage() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("plans")
        .select("id, type, title, created_at, validation")
        .order("created_at", { ascending: false });
      if (cancelled) return;
      setPlans((data as PlanRow[]) ?? []);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-dvh bg-background">
      <div className="max-w-md mx-auto px-4 py-6">
        <AppHeader historyCount={0} showHistoryLink={false} />

        <h2 className="text-2xl font-bold text-foreground mb-1">Plans</h2>
        <p className="text-sm text-muted mb-6">
          Built from your guidance, his preferences and what he&apos;s doing
          that day.
        </p>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <Link
            href="/plan/game-day"
            className="bg-accent text-background rounded-xl p-4 text-center font-medium hover:bg-accent-muted transition-colors"
          >
            Game day
          </Link>
          <Link
            href="/plan/weekly"
            className="bg-card border border-card-border rounded-xl p-4 text-center font-medium text-foreground hover:border-accent/50 transition-colors"
          >
            Full week
          </Link>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : plans.length === 0 ? (
          <p className="text-sm text-muted text-center py-8">
            No plans yet.
          </p>
        ) : (
          <div className="space-y-2">
            {plans.map((p) => (
              <Link
                key={p.id}
                href={`/plans/${p.id}`}
                className="block bg-card border border-card-border rounded-xl p-3 hover:border-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground flex-1">
                    {p.title ?? "Untitled plan"}
                  </p>
                  {p.validation.length > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 flex-shrink-0">
                      {p.validation.length}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted mt-1">
                  {p.type === "game_day" ? "Game day" : "Weekly"} ·{" "}
                  {new Date(p.created_at).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
