import type { ActiveRule } from "./context";
import type { GameDayPlan, PlanTargets, WeeklyPlan } from "./schema";

/**
 * Checks a generated plan against the numeric rules that apply to it.
 *
 * This is the reason rules are typed rather than prose. The model is asked to
 * hit the targets; this verifies it did, in code, so a plan that quietly comes
 * in under the protein target gets flagged instead of shipped.
 */

export interface Finding {
  severity: "miss" | "unmet";
  rule_id: string;
  nutrient: string;
  expected: string;
  found: string;
  where: string;
}

const NUTRIENT_FIELD: Record<string, keyof PlanTargets> = {
  protein: "protein_g",
  carbohydrate: "carbohydrate_g",
  simple_carbohydrate: "carbohydrate_g",
  complex_carbohydrate: "carbohydrate_g",
  fat: "fat_g",
  fluid: "fluid_oz",
};

/** A per-kg rule means nothing until multiplied out for this athlete. */
function resolveRange(
  rule: ActiveRule,
  weightKg: number | null
): { lo: number; hi: number } | null {
  if (rule.value_min === null) return null;
  const hi = rule.value_max ?? rule.value_min;
  if (rule.basis === "per_kg") {
    if (!weightKg) return null;
    return { lo: rule.value_min * weightKg, hi: hi * weightKg };
  }
  if (rule.basis === "absolute") return { lo: rule.value_min, hi };
  return null; // percent_of_plate / qualitative aren't window targets
}

function windowsOverlap(
  aMin: number | null,
  aMax: number | null,
  bMin: number | null,
  bMax: number | null
): boolean {
  if (aMin === null || bMin === null) return true; // untimed rule applies broadly
  return aMin <= (bMax ?? bMin) && bMin <= (aMax ?? aMin);
}

export function validateGameDayPlan(
  plan: GameDayPlan,
  rules: ActiveRule[],
  weightKg: number | null
): Finding[] {
  const findings: Finding[] = [];

  for (const rule of rules) {
    if (rule.anchor !== "game") continue;
    const field = NUTRIENT_FIELD[rule.nutrient];
    if (!field) continue;
    const range = resolveRange(rule, weightKg);
    if (!range) continue;

    // Rules anchored to "game" count from the end of the match when they look
    // backwards from it, and from kickoff when they look forwards to it. A
    // window must be measured from the same end before its offsets mean
    // anything — otherwise a correct recovery window at 100 minutes after
    // kickoff reads as missing the 0-30-minutes-after-the-game rule.
    const expectedOrigin = rule.direction === "after" ? "final_whistle" : "kickoff";

    const candidates = plan.windows.filter(
      (w) =>
        w.direction === rule.direction &&
        w.relative_to === expectedOrigin &&
        windowsOverlap(
          rule.offset_min_minutes,
          rule.offset_max_minutes,
          w.offset_min_minutes,
          w.offset_max_minutes
        )
    );

    if (candidates.length === 0) {
      findings.push({
        severity: "unmet",
        rule_id: rule.id,
        nutrient: rule.nutrient,
        expected: `${Math.round(range.lo)}-${Math.round(range.hi)} ${rule.unit ?? ""}`.trim(),
        found: "no window covers this moment",
        where: `${rule.offset_min_minutes ?? "?"}-${rule.offset_max_minutes ?? "?"} min ${rule.direction} game`,
      });
      continue;
    }

    // Several windows can share a moment; the rule is satisfied if their
    // combined target lands in range.
    const total = candidates.reduce(
      (sum, w) => sum + (w.targets[field] ?? 0),
      0
    );

    // 10% tolerance: these are estimates against estimates, and flagging a
    // 29g-against-30g plan would train the reader to ignore findings.
    if (total < range.lo * 0.9) {
      findings.push({
        severity: "miss",
        rule_id: rule.id,
        nutrient: rule.nutrient,
        expected: `${Math.round(range.lo)}-${Math.round(range.hi)} ${rule.unit ?? ""}`.trim(),
        found: `${Math.round(total)}`,
        where: candidates.map((w) => w.label).join(" + "),
      });
    }
  }

  return findings;
}

export function validateWeeklyPlan(
  plan: WeeklyPlan,
  rules: ActiveRule[],
  weightKg: number | null
): Finding[] {
  const findings: Finding[] = [];

  // A weekly plan is checked per training day: rules anchored to practice
  // should be met on days that actually have one.
  for (const day of plan.days) {
    const isTraining = /practice|training/i.test(day.activity);
    const isGame = /game|match/i.test(day.activity);
    if (!isTraining && !isGame) continue;

    for (const rule of rules) {
      const anchorMatches =
        (rule.anchor === "practice" && isTraining) ||
        (rule.anchor === "game" && isGame);
      if (!anchorMatches) continue;

      const field = NUTRIENT_FIELD[rule.nutrient];
      if (!field) continue;
      const range = resolveRange(rule, weightKg);
      if (!range) continue;

      const dayTotal = day.meals.reduce(
        (sum, m) => sum + (m.targets[field] ?? 0),
        0
      );

      if (dayTotal < range.lo * 0.9) {
        findings.push({
          severity: "miss",
          rule_id: rule.id,
          nutrient: rule.nutrient,
          expected: `at least ${Math.round(range.lo)} ${rule.unit ?? ""} around ${rule.anchor}`.trim(),
          found: `${Math.round(dayTotal)} across the day`,
          where: day.day,
        });
      }
    }
  }

  return findings;
}
