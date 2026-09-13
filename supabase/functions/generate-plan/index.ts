/**
 * Plan generation, on Supabase Edge Functions rather than Vercel.
 *
 * Measured: this job takes 50-95 seconds against the real 80-rule ruleset, and
 * varies widely run to run (identical requests came back at 68s and 92s).
 * Vercel Hobby kills functions at 60s, so no amount of effort or prompt tuning
 * makes it reliable there -- constraining the output actually made it SLOWER,
 * because consolidating 80 rules into 6 windows is harder reasoning than
 * listing 14. Edge Functions allow ~150s, which clears the worst case.
 *
 * The TypeScript interfaces for these shapes live in src/lib/plans/schema.ts
 * for the UI. If you change a field here, change it there too.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

// ---------------------------------------------------------------- schemas

const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const str = { type: "string" };
const numOrNull = { anyOf: [{ type: "number" }, { type: "null" }] };
const strList = { type: "array", items: str };

const TARGETS = obj({
  protein_g: numOrNull,
  carbohydrate_g: numOrNull,
  fat_g: numOrNull,
  fluid_oz: numOrNull,
});

const GAME_DAY_SCHEMA = obj({
  title: str,
  kickoff_time: str,
  windows: {
    type: "array",
    items: obj({
      label: str,
      direction: { type: "string", enum: ["before", "during", "after"] },
      // Which end of the match offsets count from. Without it, "30 min after
      // the game" and "120 min after kickoff" are the same moment but cannot
      // be compared, and validation reports phantom misses.
      relative_to: { type: "string", enum: ["kickoff", "final_whistle"] },
      offset_min_minutes: numOrNull,
      offset_max_minutes: numOrNull,
      what_to_eat: str,
      foods: strList,
      targets: TARGETS,
      why: str,
    }),
  },
  hydration_plan: str,
  watch_outs: strList,
  disclaimer: str,
});

const WEEKLY_SCHEMA = obj({
  title: str,
  week_starting: str,
  days: {
    type: "array",
    items: obj({
      day: str,
      activity: str,
      meals: {
        type: "array",
        items: obj({
          slot: str,
          time_of_day: str,
          what_to_eat: str,
          foods: strList,
          targets: TARGETS,
          batch_prep: { type: "boolean" },
        }),
      },
      hydration: str,
      notes: str,
    }),
  },
  batch_prep_plan: strList,
  shopping_themes: strList,
  disclaimer: str,
});

// ---------------------------------------------------------------- context

// deno-lint-ignore no-explicit-any
type Row = any;

function ageFrom(birthdate: string | null): string {
  if (!birthdate) return "unknown";
  return `${Math.floor((Date.now() - new Date(birthdate).getTime()) / 31_557_600_000)}`;
}

/** Resolve a rule to concrete numbers. Leaving per-kg arithmetic to the model
 *  invites it to be done differently from one plan to the next. */
function describeRule(rule: Row, weightKg: number | null): string {
  const when =
    rule.anchor === "none"
      ? "any time"
      : rule.offset_min_minutes === null
        ? `${rule.direction} ${rule.anchor}`
        : rule.offset_min_minutes === rule.offset_max_minutes
          ? `${rule.offset_min_minutes} min ${rule.direction} ${rule.anchor}`
          : `${rule.offset_min_minutes}-${rule.offset_max_minutes} min ${rule.direction} ${rule.anchor}`;

  const scope = rule.condition === "any" ? "" : ` [${rule.condition}]`;

  if (rule.basis === "qualitative" || rule.value_min === null) {
    return `- ${rule.nutrient}: directional guidance, ${when}${scope}`;
  }

  const range =
    Number(rule.value_min) === Number(rule.value_max)
      ? `${rule.value_min}`
      : `${rule.value_min}-${rule.value_max}`;

  if (rule.basis === "per_kg" && weightKg) {
    const lo = Math.round(Number(rule.value_min) * weightKg);
    const hi = Math.round(Number(rule.value_max ?? rule.value_min) * weightKg);
    return `- ${rule.nutrient}: ${lo === hi ? lo : `${lo}-${hi}`} g (${range} ${rule.unit ?? "g/kg"} x ${weightKg}kg), ${when}${scope}`;
  }

  return `- ${rule.nutrient}: ${range} ${rule.unit ?? ""}, ${when}${scope}`;
}

/**
 * Trims the food lists before they reach the prompt.
 *
 * Extraction produced 361 options across 43 slot names, because three
 * documents label the same moment differently ("FAST FUEL", "30 Minutes
 * Before Game", "Pre-Game Snacks"). Reconciling those is reasoning the model
 * has to do before it writes anything, and it was a major part of why
 * generation overran. Keep the slots that carry real variety, cap each one,
 * and drop the long tail.
 */
function condenseOptions(options: Row[], maxSlots = 14, maxPerSlot = 8): Row[] {
  const bySlot = new Map<string, Row[]>();
  const seen = new Set<string>();

  for (const o of options) {
    const key = `${o.slot}|${o.food.toLowerCase().trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const list = bySlot.get(o.slot) ?? [];
    if (list.length < maxPerSlot) list.push(o);
    bySlot.set(o.slot, list);
  }

  return [...bySlot.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, maxSlots)
    .flatMap(([, list]) => list);
}

function buildContext(
  rules: Row[],
  modifiers: Row[],
  profile: Row,
  prefs: Row | null,
  options: Row[],
): string {
  const weight = profile.weight_kg ? Number(profile.weight_kg) : null;
  const byRule = new Map<string, Row[]>();
  for (const m of modifiers) {
    const list = byRule.get(m.active_rule_id) ?? [];
    list.push(m);
    byRule.set(m.active_rule_id, list);
  }

  const lines: string[] = [
    "# THE ATHLETE",
    `Name: ${profile.name}`,
    `Age: ${ageFrom(profile.birthdate)}`,
    `Weight: ${weight ? `${weight} kg` : "NOT SET"}`,
  ];
  if (profile.height_cm) lines.push(`Height: ${profile.height_cm} cm`);
  if (profile.position) lines.push(`Position: ${profile.position}`);
  if (profile.notes) lines.push(`Notes: ${profile.notes}`);

  lines.push("\n# HARD CONSTRAINTS");
  lines.push(
    prefs?.allergies?.length
      ? `ALLERGIES — never include these or anything containing them: ${prefs.allergies.join(", ")}`
      : "No allergies recorded.",
  );

  lines.push("\n# PREFERENCES");
  if (prefs && (prefs.likes?.length || prefs.dislikes?.length || prefs.aversions?.length || prefs.cuisines?.length || prefs.notes)) {
    if (prefs.likes?.length) lines.push(`Loves: ${prefs.likes.join(", ")}`);
    if (prefs.dislikes?.length) lines.push(`Won't eat: ${prefs.dislikes.join(", ")}`);
    if (prefs.aversions?.length) lines.push(`Avoid these textures/preparations: ${prefs.aversions.join(", ")}`);
    if (prefs.cuisines?.length) lines.push(`Enjoys: ${prefs.cuisines.join(", ")}`);
    if (prefs.notes) lines.push(`Other: ${prefs.notes}`);
  } else {
    lines.push("None recorded yet — keep choices mainstream and easy to swap.");
  }

  const numeric = rules.filter((r) => r.basis !== "qualitative");
  const directional = rules.filter((r) => r.basis === "qualitative");

  lines.push("\n# NUMERIC TARGETS FROM THE GUIDANCE");
  lines.push("These are checked in code after you answer. A plan that misses them is flagged.");
  for (const r of numeric) {
    lines.push(describeRule(r, weight));
    for (const m of byRule.get(r.id) ?? []) {
      const adj = m.value_min === null ? (m.note ?? "adjust") : `${m.value_min}-${m.value_max} ${m.unit ?? ""}`.trim();
      lines.push(`    - when ${m.trigger}: ${adj}`);
    }
  }

  lines.push("\n# DIRECTIONAL GUIDANCE");
  for (const r of directional) lines.push(describeRule(r, weight));

  if (options.length) {
    lines.push("\n# FOODS THE GUIDANCE RECOMMENDS, BY MOMENT");
    const bySlot = new Map<string, string[]>();
    for (const o of options) {
      const list = bySlot.get(o.slot) ?? [];
      list.push(o.food);
      bySlot.set(o.slot, list);
    }
    for (const [slot, foods] of bySlot) {
      lines.push(`${slot}: ${[...new Set(foods)].join(", ")}`);
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------- validation

const NUTRIENT_FIELD: Record<string, string> = {
  protein: "protein_g",
  carbohydrate: "carbohydrate_g",
  simple_carbohydrate: "carbohydrate_g",
  complex_carbohydrate: "carbohydrate_g",
  fat: "fat_g",
  fluid: "fluid_oz",
};

function resolveRange(rule: Row, weightKg: number | null) {
  if (rule.value_min === null) return null;
  const lo = Number(rule.value_min);
  const hi = Number(rule.value_max ?? rule.value_min);
  if (rule.basis === "per_kg") return weightKg ? { lo: lo * weightKg, hi: hi * weightKg } : null;
  if (rule.basis === "absolute") return { lo, hi };
  return null;
}

function overlaps(aMin: number | null, aMax: number | null, bMin: number | null, bMax: number | null) {
  if (aMin === null || bMin === null) return true;
  return aMin <= (bMax ?? bMin) && bMin <= (aMax ?? aMin);
}

function validateGameDay(plan: Row, rules: Row[], weightKg: number | null) {
  const findings: Row[] = [];
  for (const rule of rules) {
    if (rule.anchor !== "game") continue;
    const field = NUTRIENT_FIELD[rule.nutrient];
    const range = resolveRange(rule, weightKg);
    if (!field || !range) continue;

    const origin = rule.direction === "after" ? "final_whistle" : "kickoff";
    const candidates = plan.windows.filter(
      (w: Row) =>
        w.direction === rule.direction &&
        w.relative_to === origin &&
        overlaps(rule.offset_min_minutes, rule.offset_max_minutes, w.offset_min_minutes, w.offset_max_minutes),
    );

    if (!candidates.length) {
      findings.push({
        severity: "unmet", rule_id: rule.id, nutrient: rule.nutrient,
        expected: `${Math.round(range.lo)}-${Math.round(range.hi)} ${rule.unit ?? ""}`.trim(),
        found: "no window covers this moment",
        where: `${rule.offset_min_minutes ?? "?"}-${rule.offset_max_minutes ?? "?"} min ${rule.direction} game`,
      });
      continue;
    }

    const total = candidates.reduce((s: number, w: Row) => s + (w.targets[field] ?? 0), 0);
    // 10% tolerance: estimates against estimates. Flagging 29g against 30g
    // would train the reader to ignore findings entirely.
    if (total < range.lo * 0.9) {
      findings.push({
        severity: "miss", rule_id: rule.id, nutrient: rule.nutrient,
        expected: `${Math.round(range.lo)}-${Math.round(range.hi)} ${rule.unit ?? ""}`.trim(),
        found: `${Math.round(total)}`,
        where: candidates.map((w: Row) => w.label).join(" + "),
      });
    }
  }
  return findings;
}

function validateWeekly(plan: Row, rules: Row[], weightKg: number | null) {
  const findings: Row[] = [];
  for (const day of plan.days) {
    const isTraining = /practice|training/i.test(day.activity);
    const isGame = /game|match/i.test(day.activity);
    if (!isTraining && !isGame) continue;

    for (const rule of rules) {
      if (!((rule.anchor === "practice" && isTraining) || (rule.anchor === "game" && isGame))) continue;
      const field = NUTRIENT_FIELD[rule.nutrient];
      const range = resolveRange(rule, weightKg);
      if (!field || !range) continue;

      const total = day.meals.reduce((s: number, m: Row) => s + (m.targets[field] ?? 0), 0);
      if (total < range.lo * 0.9) {
        findings.push({
          severity: "miss", rule_id: rule.id, nutrient: rule.nutrient,
          expected: `at least ${Math.round(range.lo)} ${rule.unit ?? ""} around ${rule.anchor}`.trim(),
          found: `${Math.round(total)} across the day`,
          where: day.day,
        });
      }
    }
  }
  return findings;
}

// ---------------------------------------------------------------- generation

const SHARED_RULES = `You build nutrition plans for one specific teenage soccer player, from guidance their parent has provided.

Ground every recommendation in the guidance context above. Where it gives a numeric target, hit it — those are checked in code after you answer, and a plan that misses one is flagged to the parent.

Absolute constraints:
- Never include a listed allergen, or any dish that ordinarily contains one.
- Never suggest a food on the "won't eat" list. Preferences are not obstacles to work around; a technically optimal plan he refuses to eat is a failed plan.
- Fill in targets for every meal or window. A null target means "this moment genuinely has no target for that nutrient", not "I didn't work it out".

Tone: you are writing for a parent and a teenager, not a clinician. Be concrete about foods and portions. Never frame anything as restriction or as a warning about weight — focus on what to add and why it helps him play better.`;

async function callModel(apiKey: string, context: string, request: string, schema: unknown) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 16000,
      output_config: { effort: "medium", format: { type: "json_schema", schema } },
      system: [
        { type: "text", text: SHARED_RULES },
        // Stable across every plan; cached so repeat generations are cheaper.
        { type: "text", text: context, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: [{ type: "text", text: request }] }],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  if (data.stop_reason === "max_tokens") throw new Error("Plan was truncated before it finished.");
  if (data.stop_reason === "refusal") throw new Error("Request was declined by safety classifiers.");

  const text = data.content?.find((b: Row) => b.type === "text")?.text;
  if (!text) throw new Error("No content returned.");
  return { plan: JSON.parse(text), usage: data.usage };
}

// ---------------------------------------------------------------- handler

Deno.serve(async (req) => {
  const startedAt = Date.now();
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return json({ error: "ANTHROPIC_API_KEY is not set on this function." }, 500);
    }

    const { type, kickoffTime, weekStarting, schedule, notes } = await req.json();
    if (type !== "game_day" && type !== "weekly") {
      return json({ error: "Unknown plan type" }, 400);
    }

    // Scoped to the caller's session, so every read and write goes through RLS
    // exactly as it would from the app.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );

    const [rulesetRes, profileRes, prefsRes, optionsRes] = await Promise.all([
      supabase.from("active_rulesets").select("id, version").order("version", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("athlete_profile").select("*").limit(1).maybeSingle(),
      supabase.from("preferences").select("*").order("version", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("extracted_options").select("slot, category, food").neq("status", "rejected"),
    ]);

    const ruleset = rulesetRes.data;
    const profile = profileRes.data;

    // Refuse rather than degrade: a plan built without these is not a worse
    // plan, it is a fabricated one.
    if (!ruleset) return json({ error: "No published ruleset. Approve and publish guidance rules first." }, 400);
    if (!profile) return json({ error: "No athlete profile yet. Add one in Settings." }, 400);
    if (!profile.weight_kg) {
      return json({ error: "Athlete weight is not set. Every per-kilogram rule in your guidance depends on it." }, 400);
    }

    const { data: rules } = await supabase.from("active_rules").select("*").eq("ruleset_id", ruleset.id);
    const { data: modifiers } = await supabase
      .from("active_rule_modifiers").select("*")
      .in("active_rule_id", (rules ?? []).map((r: Row) => r.id));

    // A game-day plan cannot use practice-anchored rules. Passing them means
    // the model reasons about 15 rules it must then discard.
    const allRules = rules ?? [];
    const relevantRules = type === "game_day"
      ? allRules.filter((r: Row) => r.anchor === "game" || r.anchor === "none")
      : allRules;

    const condensed = condenseOptions(optionsRes.data ?? []);
    const context = buildContext(relevantRules, modifiers ?? [], profile, prefsRes.data, condensed);
    const weight = Number(profile.weight_kg);

    console.log(JSON.stringify({
      stage: "context_built",
      type,
      rules_total: allRules.length,
      rules_used: relevantRules.length,
      options_total: (optionsRes.data ?? []).length,
      options_used: condensed.length,
      context_chars: context.length,
      elapsed_ms: Date.now() - startedAt,
    }));

    const request = type === "game_day"
      ? `Build a game-day fuelling plan.

Kickoff: ${kickoffTime ?? "unspecified"}
${notes ? `Context for this particular game: ${notes}` : ""}

Work backwards and forwards from the match, one window per distinct moment the guidance identifies — the full meal hours before, the top-off closer in, the fast fuel just before, anything during, and recovery afterwards.

Set relative_to for every window: "kickoff" for anything before or during the match, "final_whistle" for anything after it. Offsets are minutes from that point, so a recovery snack half an hour after the match ends is relative_to "final_whistle" with offsets 0 to 30. State real clock times in the labels too, assuming a 90-minute match.

If any guidance modifier could apply — heat, a long match, a short turnaround between games — cover it in watch_outs.`
      : `Build a week of fuelling.

Week starting: ${weekStarting ?? "this week"}
Schedule:
${schedule ?? "No schedule supplied."}
${notes ? `\nContext for this week: ${notes}` : ""}

Cover every day, including rest days. Match each day's meals to what that day actually demands — a day with an evening practice is fuelled differently from a rest day, and a game day follows the game-day timing from the guidance rather than a generic template.

Mark batch_prep true for anything that can be made in bulk at the weekend, and use batch_prep_plan to say what to cook when. He is a capable teenager cooking for himself on weeknights, so weekday items should be assemble-not-cook wherever the guidance allows.`;

    const { plan, usage } = await callModel(
      apiKey, context, request,
      type === "game_day" ? GAME_DAY_SCHEMA : WEEKLY_SCHEMA,
    );

    console.log(JSON.stringify({ stage: "model_done", elapsed_ms: Date.now() - startedAt, usage }));

    const findings = type === "game_day"
      ? validateGameDay(plan, allRules, weight)
      : validateWeekly(plan, allRules, weight);

    const { data: saved, error: saveErr } = await supabase
      .from("plans")
      .insert({
        type,
        title: plan.title,
        ruleset_version: ruleset.version,
        preferences_version: prefsRes.data?.version ?? null,
        weight_kg_at_generation: weight,
        input_params: { kickoffTime, weekStarting, schedule, notes },
        content: plan,
        validation: findings,
      })
      .select("id")
      .single();

    if (saveErr) return json({ error: saveErr.message }, 500);
    console.log(JSON.stringify({ stage: "done", elapsed_ms: Date.now() - startedAt, findings: findings.length }));
    return json({ id: saved.id, findings, usage });
  } catch (err) {
    console.error(JSON.stringify({ stage: "failed", elapsed_ms: Date.now() - startedAt, error: String(err) }));
    return json({ error: err instanceof Error ? err.message : "Plan generation failed" }, 502);
  }
});
