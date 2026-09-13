"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/client";
import type { GameDayPlan, PlanTargets, WeeklyPlan } from "@/lib/plans/schema";

interface Finding {
  severity: string;
  nutrient: string;
  expected: string;
  found: string;
  where: string;
}

interface PlanRow {
  id: string;
  type: "game_day" | "weekly";
  title: string | null;
  created_at: string;
  ruleset_version: number | null;
  preferences_version: number | null;
  weight_kg_at_generation: number | null;
  content: GameDayPlan | WeeklyPlan;
  validation: Finding[];
}

function Targets({ targets }: { targets: PlanTargets }) {
  const parts = [
    targets.protein_g !== null && `${targets.protein_g}g protein`,
    targets.carbohydrate_g !== null && `${targets.carbohydrate_g}g carbs`,
    targets.fat_g !== null && `${targets.fat_g}g fat`,
    targets.fluid_oz !== null && `${targets.fluid_oz}oz fluid`,
  ].filter(Boolean) as string[];

  if (parts.length === 0) return null;
  return <p className="text-xs text-accent mt-1">{parts.join(" · ")}</p>;
}

export default function PlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [plan, setPlan] = useState<PlanRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("plans")
        .select("*")
        .eq("id", id)
        .single();
      if (cancelled) return;
      setPlan((data as PlanRow) ?? null);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-dvh bg-background">
        <div className="max-w-md mx-auto px-4 py-6">
          <AppHeader historyCount={0} showHistoryLink={false} />
          <p className="text-muted text-center py-12">Plan not found.</p>
        </div>
      </div>
    );
  }

  const gameDay = plan.type === "game_day" ? (plan.content as GameDayPlan) : null;
  const weekly = plan.type === "weekly" ? (plan.content as WeeklyPlan) : null;

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

        <h2 className="text-xl font-bold text-foreground mt-2 mb-4">
          {plan.content.title}
        </h2>

        {/* Shown before the plan: if code found the plan missing a rule, that
            matters more than anything the plan says about itself. */}
        {plan.validation.length > 0 && (
          <section className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-4">
            <h3 className="text-sm font-medium text-yellow-300 mb-2">
              {plan.validation.length} guidance target
              {plan.validation.length !== 1 ? "s" : ""} not met
            </h3>
            {plan.validation.map((f, i) => (
              <p key={i} className="text-xs text-foreground/80 mb-1">
                <span className="font-medium">
                  {f.nutrient.replace(/_/g, " ")}
                </span>{" "}
                — wanted {f.expected}, plan has {f.found} ({f.where})
              </p>
            ))}
          </section>
        )}

        {gameDay && (
          <div className="space-y-3">
            {gameDay.windows.map((w, i) => (
              <div
                key={i}
                className="bg-card border border-card-border rounded-xl p-4"
              >
                <p className="font-medium text-foreground text-sm">{w.label}</p>
                <Targets targets={w.targets} />
                <p className="text-sm text-foreground/80 mt-2">
                  {w.what_to_eat}
                </p>
                {w.foods.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {w.foods.map((f) => (
                      <span
                        key={f}
                        className="text-xs px-2 py-0.5 rounded-full bg-background text-foreground/80"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted mt-2">{w.why}</p>
              </div>
            ))}

            <div className="bg-card border border-card-border rounded-xl p-4">
              <h3 className="text-sm font-medium text-muted mb-1">Hydration</h3>
              <p className="text-sm text-foreground/80">
                {gameDay.hydration_plan}
              </p>
            </div>

            {gameDay.watch_outs.length > 0 && (
              <div className="bg-card border border-card-border rounded-xl p-4">
                <h3 className="text-sm font-medium text-muted mb-2">
                  Watch out for
                </h3>
                <ul className="space-y-1.5">
                  {gameDay.watch_outs.map((w, i) => (
                    <li key={i} className="text-sm text-foreground/80 flex gap-2">
                      <span className="text-accent">·</span>
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {weekly && (
          <div className="space-y-3">
            {weekly.days.map((d, i) => (
              <div
                key={i}
                className="bg-card border border-card-border rounded-xl p-4"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-medium text-foreground">{d.day}</p>
                  <p className="text-xs text-muted">{d.activity}</p>
                </div>

                <div className="space-y-2 mt-3">
                  {d.meals.map((m, j) => (
                    <div key={j} className="border-l-2 border-card-border pl-3">
                      <p className="text-sm font-medium text-foreground">
                        {m.slot}
                        <span className="text-muted font-normal text-xs">
                          {" "}
                          · {m.time_of_day}
                        </span>
                        {m.batch_prep && (
                          <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-accent/15 text-accent">
                            batch
                          </span>
                        )}
                      </p>
                      <Targets targets={m.targets} />
                      <p className="text-sm text-foreground/80 mt-1">
                        {m.what_to_eat}
                      </p>
                    </div>
                  ))}
                </div>

                {d.hydration && (
                  <p className="text-xs text-muted mt-3">{d.hydration}</p>
                )}
              </div>
            ))}

            {weekly.batch_prep_plan.length > 0 && (
              <div className="bg-card border border-card-border rounded-xl p-4">
                <h3 className="text-sm font-medium text-muted mb-2">
                  Batch prep
                </h3>
                <ul className="space-y-1.5">
                  {weekly.batch_prep_plan.map((b, i) => (
                    <li key={i} className="text-sm text-foreground/80 flex gap-2">
                      <span className="text-accent">·</span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Provenance: what this plan was built from. Rules get edited,
            preferences change and he grows, so a plan without this becomes
            unexplainable a month later. */}
        <p className="text-xs text-muted mt-6 text-center">
          Built {new Date(plan.created_at).toLocaleDateString()} from ruleset v
          {plan.ruleset_version ?? "?"}
          {plan.preferences_version
            ? `, preferences v${plan.preferences_version}`
            : ", no preferences set"}
          {plan.weight_kg_at_generation
            ? `, at ${plan.weight_kg_at_generation} kg`
            : ""}
          .
        </p>
        <p className="text-xs text-muted mt-2 text-center px-4">
          {plan.content.disclaimer}
        </p>
      </div>
    </div>
  );
}
