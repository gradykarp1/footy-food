import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Resolves every approved rule across all documents into a new, versioned
 * active ruleset — the only thing plan generation ever reads.
 *
 * Publishing is additive: each call creates a new version rather than mutating
 * the last one, so a plan can always record which ruleset produced it and an
 * unwelcome change can be rolled back by publishing again from edited rules.
 */
export async function POST() {
  try {
    const supabase = await createClient();

    const { data: rules, error: rulesError } = await supabase
      .from("extracted_rules")
      .select("*")
      .eq("status", "approved");

    if (rulesError) {
      return NextResponse.json({ error: rulesError.message }, { status: 500 });
    }
    if (!rules || rules.length === 0) {
      return NextResponse.json(
        { error: "No approved rules to publish." },
        { status: 400 }
      );
    }

    const { data: latest } = await supabase
      .from("active_rulesets")
      .select("version")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const version = (latest?.version ?? 0) + 1;

    const { data: ruleset, error: rsError } = await supabase
      .from("active_rulesets")
      .insert({ version, note: `${rules.length} approved rules` })
      .select("id, version")
      .single();

    if (rsError || !ruleset) {
      return NextResponse.json(
        { error: rsError?.message ?? "Could not create ruleset" },
        { status: 500 }
      );
    }

    const { data: inserted, error: arError } = await supabase
      .from("active_rules")
      .insert(
        rules.map((r) => ({
          ruleset_id: ruleset.id,
          kind: r.kind,
          nutrient: r.nutrient,
          value_min: r.value_min,
          value_max: r.value_max,
          unit: r.unit,
          basis: r.basis,
          anchor: r.anchor,
          direction: r.direction,
          offset_min_minutes: r.offset_min_minutes,
          offset_max_minutes: r.offset_max_minutes,
          condition: r.condition,
          resolved_from: [r.id],
        }))
      )
      .select("id");

    if (arError) {
      return NextResponse.json({ error: arError.message }, { status: 500 });
    }

    // Carry modifiers across. They adjust their parent rule rather than
    // standing alone, so a ruleset without them would silently mis-plan a
    // tournament or a hot day.
    const ruleIdToActive = new Map(rules.map((r, i) => [r.id, inserted![i].id]));
    const { data: modifiers } = await supabase
      .from("rule_modifiers")
      .select("*")
      .in(
        "rule_id",
        rules.map((r) => r.id)
      );

    if (modifiers && modifiers.length > 0) {
      await supabase.from("active_rule_modifiers").insert(
        modifiers.map((m) => ({
          active_rule_id: ruleIdToActive.get(m.rule_id),
          trigger: m.trigger,
          value_min: m.value_min,
          value_max: m.value_max,
          unit: m.unit,
          note: m.note,
        }))
      );
    }

    return NextResponse.json({
      version: ruleset.version,
      rules: rules.length,
      modifiers: modifiers?.length ?? 0,
    });
  } catch (error) {
    console.error("Publish error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
