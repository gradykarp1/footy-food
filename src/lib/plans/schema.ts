/**
 * Shapes of a generated plan, for the UI.
 *
 * The JSON Schema the model is constrained to lives in
 * supabase/functions/generate-plan/index.ts, which is the only place that
 * calls the model. Change a field there and change it here too.
 */

export interface PlanTargets {
  protein_g: number | null;
  carbohydrate_g: number | null;
  fat_g: number | null;
  fluid_oz: number | null;
}

export interface GameDayWindow {
  label: string;
  direction: "before" | "during" | "after";
  relative_to: "kickoff" | "final_whistle";
  offset_min_minutes: number | null;
  offset_max_minutes: number | null;
  what_to_eat: string;
  foods: string[];
  targets: PlanTargets;
  why: string;
}

export interface GameDayPlan {
  title: string;
  kickoff_time: string;
  windows: GameDayWindow[];
  hydration_plan: string;
  watch_outs: string[];
  disclaimer: string;
}

export interface WeeklyMeal {
  slot: string;
  time_of_day: string;
  what_to_eat: string;
  foods: string[];
  targets: PlanTargets;
  batch_prep: boolean;
}

export interface WeeklyPlan {
  title: string;
  week_starting: string;
  days: {
    day: string;
    activity: string;
    meals: WeeklyMeal[];
    hydration: string;
    notes: string;
  }[];
  batch_prep_plan: string[];
  shopping_themes: string[];
  disclaimer: string;
}
