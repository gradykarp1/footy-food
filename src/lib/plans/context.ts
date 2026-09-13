/**
 * Assembles the shared planning context: the active ruleset, the athlete, and
 * their preferences.
 *
 * This block is deliberately stable across requests so it can sit behind a
 * prompt-cache breakpoint — every plan, recipe and (in Phase 3) chat turn
 * resends it, and the chat resends it on every single message. Keep volatile
 * content (the actual request) out of here and after the breakpoint.
 */

export interface ActiveRule {
  id: string;
  kind: string;
  nutrient: string;
  value_min: number | null;
  value_max: number | null;
  unit: string | null;
  basis: string;
  anchor: string;
  direction: string;
  offset_min_minutes: number | null;
  offset_max_minutes: number | null;
  condition: string;
}

export interface RuleModifier {
  active_rule_id: string;
  trigger: string;
  value_min: number | null;
  value_max: number | null;
  unit: string | null;
  note: string | null;
}

export interface AthleteProfile {
  name: string;
  birthdate: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  position: string | null;
  notes: string | null;
}

export interface Preferences {
  version: number;
  likes: string[];
  dislikes: string[];
  allergies: string[];
  aversions: string[];
  cuisines: string[];
  notes: string | null;
}

export interface FoodOption {
  slot: string;
  category: string | null;
  food: string;
}

function ageFrom(birthdate: string | null): string {
  if (!birthdate) return "unknown";
  const diff = Date.now() - new Date(birthdate).getTime();
  return `${Math.floor(diff / 31_557_600_000)}`;
}

/**
 * Resolve a rule to concrete numbers for this athlete. A per-kg rule is
 * meaningless in a prompt until multiplied out, and leaving the arithmetic to
 * the model invites it to be done inconsistently.
 */
export function describeRule(rule: ActiveRule, weightKg: number | null): string {
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
    rule.value_min === rule.value_max
      ? `${rule.value_min}`
      : `${rule.value_min}-${rule.value_max}`;

  if (rule.basis === "per_kg" && weightKg) {
    const lo = Math.round(rule.value_min * weightKg);
    const hi = Math.round((rule.value_max ?? rule.value_min) * weightKg);
    const resolved = lo === hi ? `${lo}` : `${lo}-${hi}`;
    return `- ${rule.nutrient}: ${resolved} g (${range} ${rule.unit ?? "g/kg"} x ${weightKg}kg), ${when}${scope}`;
  }

  return `- ${rule.nutrient}: ${range} ${rule.unit ?? ""}, ${when}${scope}`.replace(
    /\s+,/,
    ","
  );
}

export function buildPlanningContext(input: {
  rules: ActiveRule[];
  modifiers: RuleModifier[];
  profile: AthleteProfile;
  preferences: Preferences | null;
  options: FoodOption[];
}): string {
  const { rules, modifiers, profile, preferences, options } = input;
  const weight = profile.weight_kg;

  const byRule = new Map<string, RuleModifier[]>();
  for (const m of modifiers) {
    const list = byRule.get(m.active_rule_id) ?? [];
    list.push(m);
    byRule.set(m.active_rule_id, list);
  }

  const numeric = rules.filter((r) => r.basis !== "qualitative");
  const directional = rules.filter((r) => r.basis === "qualitative");

  const lines: string[] = [];

  lines.push("# THE ATHLETE");
  lines.push(`Name: ${profile.name}`);
  lines.push(`Age: ${ageFrom(profile.birthdate)}`);
  lines.push(`Weight: ${weight ? `${weight} kg` : "NOT SET"}`);
  if (profile.height_cm) lines.push(`Height: ${profile.height_cm} cm`);
  if (profile.position) lines.push(`Position: ${profile.position}`);
  if (profile.notes) lines.push(`Notes: ${profile.notes}`);

  lines.push("\n# HARD CONSTRAINTS");
  if (preferences?.allergies.length) {
    lines.push(
      `ALLERGIES — never include these or anything containing them: ${preferences.allergies.join(", ")}`
    );
  } else {
    lines.push("No allergies recorded.");
  }

  lines.push("\n# PREFERENCES");
  if (preferences) {
    if (preferences.likes.length) lines.push(`Loves: ${preferences.likes.join(", ")}`);
    if (preferences.dislikes.length)
      lines.push(`Won't eat: ${preferences.dislikes.join(", ")}`);
    if (preferences.aversions.length)
      lines.push(`Avoid these textures/preparations: ${preferences.aversions.join(", ")}`);
    if (preferences.cuisines.length)
      lines.push(`Enjoys: ${preferences.cuisines.join(", ")}`);
    if (preferences.notes) lines.push(`Other: ${preferences.notes}`);
  } else {
    lines.push("None recorded yet.");
  }

  lines.push("\n# NUMERIC TARGETS FROM THE GUIDANCE");
  lines.push(
    "These are checked in code after you answer. A plan that misses them is flagged."
  );
  for (const r of numeric) {
    lines.push(describeRule(r, weight));
    for (const m of byRule.get(r.id) ?? []) {
      const adj =
        m.value_min === null
          ? (m.note ?? "adjust")
          : `${m.value_min}-${m.value_max} ${m.unit ?? ""}`.trim();
      lines.push(`    - when ${m.trigger}: ${adj}`);
    }
  }

  lines.push("\n# DIRECTIONAL GUIDANCE");
  lines.push("No fixed numbers, but shapes what to choose and when.");
  for (const r of directional) lines.push(describeRule(r, weight));

  if (options.length > 0) {
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
