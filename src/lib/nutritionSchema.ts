/**
 * JSON Schema for NutritionData, enforced via output_config.format so the model
 * cannot return prose, a markdown fence, or a malformed object.
 *
 * Keep in sync with the NutritionData interface in src/types/nutrition.ts.
 *
 * Dialect constraints: every object needs additionalProperties:false and a
 * `required` listing all its properties. Recursion and numeric ranges
 * (minimum/maximum) are not supported.
 */

const number = { type: "number" } as const;
const string = { type: "string" } as const;

function objectOf(properties: Record<string, unknown>) {
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

export const NUTRITION_SCHEMA = objectOf({
  meal_title: string,
  foods_identified: { type: "array", items: string },
  confidence: { type: "string", enum: ["high", "medium", "low"] },
  calories: objectOf({
    estimate: number,
    range: string,
  }),
  macronutrients: objectOf({
    protein_g: number,
    carbohydrates_g: number,
    fat_g: number,
    fiber_g: number,
    sugar_g: number,
  }),
  micronutrients: objectOf({
    vitamin_c_mg: number,
    vitamin_d_iu: number,
    calcium_mg: number,
    iron_mg: number,
    potassium_mg: number,
    magnesium_mg: number,
    sodium_mg: number,
    b12_mcg: number,
    folate_mcg: number,
  }),
  hydration_note: string,
  soccer_performance_rating: objectOf({
    score: number,
    out_of: number,
    summary: string,
  }),
  meal_timing_feedback: objectOf({
    pre_match: string,
    post_match: string,
    rest_day: string,
  }),
  what_this_meal_does_well: { type: "array", items: string },
  what_to_add_next_time: { type: "array", items: string },
  disclaimer: string,
});
