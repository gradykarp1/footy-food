import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  ActiveRule,
  AthleteProfile,
  FoodOption,
  Preferences,
  RuleModifier,
  buildPlanningContext,
} from "@/lib/plans/context";
import {
  PlanError,
  generateGameDayPlan,
  generateWeeklyPlan,
} from "@/lib/plans/generate";
import { validateGameDayPlan, validateWeeklyPlan } from "@/lib/plans/validate";
import { GameDayPlan, WeeklyPlan } from "@/lib/plans/schema";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, kickoffTime, weekStarting, schedule, notes } = body;

    if (type !== "game_day" && type !== "weekly") {
      return NextResponse.json({ error: "Unknown plan type" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    const supabase = await createClient();

    const [rulesetRes, profileRes, prefsRes, optionsRes] = await Promise.all([
      supabase
        .from("active_rulesets")
        .select("id, version")
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("athlete_profile").select("*").limit(1).maybeSingle(),
      supabase
        .from("preferences")
        .select("*")
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("extracted_options")
        .select("slot, category, food")
        .neq("status", "rejected"),
    ]);

    const ruleset = rulesetRes.data;
    const profile = profileRes.data as AthleteProfile | null;

    // Fail early and specifically. A plan built without these is not a worse
    // plan, it is a fabricated one.
    if (!ruleset) {
      return NextResponse.json(
        { error: "No published ruleset. Approve and publish guidance rules first." },
        { status: 400 }
      );
    }
    if (!profile) {
      return NextResponse.json(
        { error: "No athlete profile yet. Add one in Settings." },
        { status: 400 }
      );
    }
    if (!profile.weight_kg) {
      return NextResponse.json(
        {
          error:
            "Athlete weight is not set. Every per-kilogram rule in your guidance depends on it, so a plan without it would be guesswork.",
        },
        { status: 400 }
      );
    }

    const { data: rules } = await supabase
      .from("active_rules")
      .select("*")
      .eq("ruleset_id", ruleset.id);

    const { data: modifiers } = await supabase
      .from("active_rule_modifiers")
      .select("*")
      .in("active_rule_id", (rules ?? []).map((r) => r.id));

    const context = buildPlanningContext({
      rules: (rules ?? []) as ActiveRule[],
      modifiers: (modifiers ?? []) as RuleModifier[],
      profile,
      preferences: prefsRes.data as Preferences | null,
      options: (optionsRes.data ?? []) as FoodOption[],
    });

    let generated;
    try {
      generated =
        type === "game_day"
          ? await generateGameDayPlan({
              apiKey,
              context,
              kickoffTime: kickoffTime ?? "unspecified",
              notes,
            })
          : await generateWeeklyPlan({
              apiKey,
              context,
              weekStarting: weekStarting ?? "this week",
              schedule: schedule ?? "No schedule supplied.",
              notes,
            });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof PlanError ? err.message : "Plan generation failed" },
        { status: 502 }
      );
    }

    // Verify in code what the model was asked to do in prose.
    const findings =
      type === "game_day"
        ? validateGameDayPlan(
            generated.plan as GameDayPlan,
            (rules ?? []) as ActiveRule[],
            profile.weight_kg
          )
        : validateWeeklyPlan(
            generated.plan as WeeklyPlan,
            (rules ?? []) as ActiveRule[],
            profile.weight_kg
          );

    const { data: saved, error: saveErr } = await supabase
      .from("plans")
      .insert({
        type,
        title: generated.plan.title,
        ruleset_version: ruleset.version,
        preferences_version: (prefsRes.data as Preferences | null)?.version ?? null,
        weight_kg_at_generation: profile.weight_kg,
        input_params: { kickoffTime, weekStarting, schedule, notes },
        content: generated.plan,
        validation: findings,
      })
      .select("id")
      .single();

    if (saveErr) {
      return NextResponse.json({ error: saveErr.message }, { status: 500 });
    }

    return NextResponse.json({
      id: saved.id,
      findings,
      usage: generated.usage,
    });
  } catch (error) {
    console.error("Plan generation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
