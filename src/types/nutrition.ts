export interface NutritionData {
  meal_title: string;
  foods_identified: string[];
  confidence: "high" | "medium" | "low";
  calories: {
    estimate: number;
    range: string;
  };
  macronutrients: {
    protein_g: number;
    carbohydrates_g: number;
    fat_g: number;
    fiber_g: number;
    sugar_g: number;
  };
  micronutrients: {
    vitamin_c_mg: number;
    vitamin_d_iu: number;
    calcium_mg: number;
    iron_mg: number;
    potassium_mg: number;
    magnesium_mg: number;
    sodium_mg: number;
    b12_mcg: number;
    folate_mcg: number;
  };
  hydration_note: string;
  soccer_performance_rating: {
    score: number;
    out_of: number;
    summary: string;
  };
  meal_timing_feedback: {
    pre_match: string;
    post_match: string;
    rest_day: string;
  };
  what_this_meal_does_well: string[];
  what_to_add_next_time: string[];
  disclaimer: string;
}

export type MealContext =
  | "pre-match"
  | "post-match"
  | "pre-training"
  | "post-training"
  | "rest-day"
  | "just-curious";

export const MEAL_CONTEXTS: { value: MealContext; label: string }[] = [
  { value: "pre-match", label: "Pre-Match" },
  { value: "post-match", label: "Post-Match" },
  { value: "pre-training", label: "Pre-Training" },
  { value: "post-training", label: "Post-Training" },
  { value: "rest-day", label: "Rest Day" },
  { value: "just-curious", label: "Just Curious" },
];

export interface MealHistoryEntry {
  id: string;
  timestamp: number;
  mealContext: MealContext;
  imagePreview?: string; // Small thumbnail, optional to save space
  nutritionData: NutritionData;
}
