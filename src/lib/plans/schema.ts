/**
 * Plan output schemas. Two shapes rather than one flexible one: a game day is
 * organised around a kickoff, a week is organised around days, and forcing both
 * through a single schema would make each worse.
 */

const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

const str = { type: "string" } as const;
const numOrNull = { anyOf: [{ type: "number" }, { type: "null" }] } as const;
const strList = { type: "array", items: str } as const;

/** What a window or meal aims to deliver. Code checks these against the rules. */
const TARGETS = obj({
  protein_g: numOrNull,
  carbohydrate_g: numOrNull,
  fat_g: numOrNull,
  fluid_oz: numOrNull,
});

const WINDOW = obj({
  label: str,
  direction: { type: "string", enum: ["before", "during", "after"] },
  // Which end of the match the offsets count from. Without this, "30 minutes
  // after the game" and "120 minutes after kickoff" describe the same moment
  // but cannot be compared, and validation reports phantom misses.
  relative_to: { type: "string", enum: ["kickoff", "final_whistle"] },
  offset_min_minutes: numOrNull,
  offset_max_minutes: numOrNull,
  what_to_eat: str,
  foods: strList,
  targets: TARGETS,
  why: str,
});

export const GAME_DAY_SCHEMA = obj({
  title: str,
  kickoff_time: str,
  windows: { type: "array", items: WINDOW },
  hydration_plan: str,
  watch_outs: strList,
  disclaimer: str,
});

const MEAL = obj({
  slot: str,
  time_of_day: str,
  what_to_eat: str,
  foods: strList,
  targets: TARGETS,
  batch_prep: { type: "boolean" },
});

const DAY = obj({
  day: str,
  activity: str,
  meals: { type: "array", items: MEAL },
  hydration: str,
  notes: str,
});

export const WEEKLY_SCHEMA = obj({
  title: str,
  week_starting: str,
  days: { type: "array", items: DAY },
  batch_prep_plan: strList,
  shopping_themes: strList,
  disclaimer: str,
});

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
