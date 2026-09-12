/**
 * Extraction schema for guidance documents. Enforced via output_config.format.
 *
 * Mirrors the extracted_rules / rule_modifiers / extracted_options /
 * extracted_context tables. The enums here must match the CHECK constraints in
 * the phase1_guidance_schema migration — Postgres rejects anything else, so a
 * drift shows up as a failed insert rather than bad data.
 */

const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

const str = { type: "string" } as const;
const num = { type: "number" } as const;
const numOrNull = { anyOf: [{ type: "number" }, { type: "null" }] } as const;
const strOrNull = { anyOf: [{ type: "string" }, { type: "null" }] } as const;

export const NUTRIENTS = [
  "protein",
  "carbohydrate",
  "simple_carbohydrate",
  "complex_carbohydrate",
  "fat",
  "fiber",
  "fluid",
  "sodium",
  "produce_color",
  "calories",
] as const;

const MODIFIER = obj({
  trigger: str,
  value_min: numOrNull,
  value_max: numOrNull,
  unit: strOrNull,
  note: strOrNull,
  verbatim_quote: str,
});

const RULE = obj({
  kind: { type: "string", enum: ["macro", "hydration", "plate_composition"] },
  nutrient: { type: "string", enum: NUTRIENTS },
  value_min: numOrNull,
  value_max: numOrNull,
  unit: strOrNull,
  basis: {
    type: "string",
    enum: ["per_kg", "absolute", "percent_of_plate", "qualitative"],
  },
  anchor: { type: "string", enum: ["game", "practice", "none"] },
  direction: { type: "string", enum: ["before", "after", "during", "n/a"] },
  offset_min_minutes: numOrNull,
  offset_max_minutes: numOrNull,
  condition: {
    type: "string",
    enum: ["any", "game_day", "training_day", "rest_day", "tournament"],
  },
  modifiers: { type: "array", items: MODIFIER },
  source_page: num,
  verbatim_quote: str,
});

export const EXTRACTION_SCHEMA = obj({
  rules: { type: "array", items: RULE },
  options: {
    type: "array",
    items: obj({ slot: str, category: strOrNull, food: str, source_page: num }),
  },
  context: {
    type: "array",
    items: obj({ section_title: str, body: str, source_page: num }),
  },
  low_confidence_pages: {
    type: "array",
    items: obj({ page: num, reason: str }),
  },
});

export interface ExtractedModifier {
  trigger: string;
  value_min: number | null;
  value_max: number | null;
  unit: string | null;
  note: string | null;
  verbatim_quote: string;
}

export interface ExtractedRule {
  kind: "macro" | "hydration" | "plate_composition";
  nutrient: (typeof NUTRIENTS)[number];
  value_min: number | null;
  value_max: number | null;
  unit: string | null;
  basis: "per_kg" | "absolute" | "percent_of_plate" | "qualitative";
  anchor: "game" | "practice" | "none";
  direction: "before" | "after" | "during" | "n/a";
  offset_min_minutes: number | null;
  offset_max_minutes: number | null;
  condition: "any" | "game_day" | "training_day" | "rest_day" | "tournament";
  modifiers: ExtractedModifier[];
  source_page: number;
  verbatim_quote: string;
}

export interface ExtractionResult {
  rules: ExtractedRule[];
  options: {
    slot: string;
    category: string | null;
    food: string;
    source_page: number;
  }[];
  context: { section_title: string; body: string; source_page: number }[];
  low_confidence_pages: { page: number; reason: string }[];
}
