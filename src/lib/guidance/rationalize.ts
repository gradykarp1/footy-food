export interface MergeableRule {
  id: string;
  document_id: string;
  nutrient: string;
  anchor: string;
  direction: string;
  condition: string;
  basis: string;
  value_min: number | null;
  value_max: number | null;
  unit: string | null;
  offset_min_minutes: number | null;
  offset_max_minutes: number | null;
  source_page: number | null;
  verbatim_quote: string;
  status: string;
}

export interface MergeGroup {
  key: string;
  keeper: MergeableRule;
  duplicates: MergeableRule[];
  /** Why these were grouped, shown so the reviewer can judge the claim. */
  reason: string;
  confidence: "identical" | "same moment";
}

/**
 * Groups rules that describe the same nutrient at the same moment.
 *
 * Deliberately ignores `condition`. Extraction assigned the same guidance
 * "any" from one document and "game_day" from another, so keying on it would
 * hide exactly the restatements worth collapsing.
 */
function groupKey(r: MergeableRule): string {
  const window =
    r.offset_min_minutes === null
      ? "untimed"
      : `${r.offset_min_minutes}-${r.offset_max_minutes}`;
  // Numeric and directional rules about the same nutrient are not the same
  // rule: one sets a target, the other shapes a choice.
  const kind = r.basis === "qualitative" ? "directional" : "numeric";
  return `${r.nutrient}|${r.anchor}|${r.direction}|${window}|${kind}`;
}

/** Windows overlap, rather than matching exactly — "30" and "0-30" are one moment. */
function overlaps(a: MergeableRule, b: MergeableRule): boolean {
  if (a.offset_min_minutes === null || b.offset_min_minutes === null) {
    return a.offset_min_minutes === b.offset_min_minutes;
  }
  return (
    a.offset_min_minutes <= (b.offset_max_minutes ?? b.offset_min_minutes) &&
    b.offset_min_minutes <= (a.offset_max_minutes ?? a.offset_min_minutes)
  );
}

/**
 * The rule to keep. Prefers the quote that carries the most context, since
 * that is what a human reads later when asking why a plan says what it says.
 */
function pickKeeper(rules: MergeableRule[]): MergeableRule {
  return [...rules].sort((a, b) => {
    const lengthDiff = b.verbatim_quote.length - a.verbatim_quote.length;
    if (lengthDiff !== 0) return lengthDiff;
    return (a.source_page ?? 999) - (b.source_page ?? 999);
  })[0];
}

export function proposeMerges(
  rules: MergeableRule[],
  dismissed: Set<string>
): MergeGroup[] {
  const buckets = new Map<string, MergeableRule[]>();
  for (const rule of rules) {
    if (rule.status !== "approved") continue;
    const key = groupKey(rule);
    buckets.set(key, [...(buckets.get(key) ?? []), rule]);
  }

  const groups: MergeGroup[] = [];

  for (const [key, members] of buckets) {
    if (members.length < 2 || dismissed.has(key)) continue;

    // Within a bucket the windows are already equal by construction, but keep
    // the check so a future looser key can't silently merge distinct moments.
    const cohesive = members.filter((m) => overlaps(members[0], m));
    if (cohesive.length < 2) continue;

    const numeric = cohesive.filter((r) => r.basis !== "qualitative");
    // Numeric rules that disagree on value are a conflict, not a duplicate.
    // Those belong in review, not here.
    if (numeric.length > 1) {
      const values = new Set(
        numeric.map((r) => `${r.value_min}-${r.value_max}-${r.unit}`)
      );
      if (values.size > 1) continue;
    }

    const keeper = pickKeeper(cohesive);
    const duplicates = cohesive.filter((r) => r.id !== keeper.id);
    const docs = new Set(cohesive.map((r) => r.document_id)).size;
    const conditions = new Set(cohesive.map((r) => r.condition));

    groups.push({
      key,
      keeper,
      duplicates,
      confidence: conditions.size === 1 ? "identical" : "same moment",
      reason:
        docs > 1
          ? `Same guidance in ${docs} documents`
          : `Restated ${cohesive.length} times in one document`,
    });
  }

  return groups.sort((a, b) => b.duplicates.length - a.duplicates.length);
}

export function describeWindow(r: MergeableRule): string {
  if (r.anchor === "none") return "any time";
  if (r.offset_min_minutes === null) return `${r.direction} ${r.anchor}`;
  const window =
    r.offset_min_minutes === r.offset_max_minutes
      ? `${r.offset_min_minutes}m`
      : `${r.offset_min_minutes}–${r.offset_max_minutes}m`;
  return `${window} ${r.direction} ${r.anchor}`;
}

export function describeValue(r: MergeableRule): string {
  if (r.basis === "qualitative" || r.value_min === null) return "directional";
  const value =
    r.value_min === r.value_max
      ? `${r.value_min}`
      : `${r.value_min}–${r.value_max}`;
  return r.unit ? `${value} ${r.unit}` : value;
}
