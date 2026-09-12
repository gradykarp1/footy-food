import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  MealContext,
  MealHistoryEntry,
  MealSource,
  NutritionData,
} from "@/types/nutrition";

// Generous page size for the history view. There is deliberately no hard cap
// on stored rows — the old 100-entry Redis ceiling made trends over arbitrary
// ranges impossible.
const DEFAULT_LIMIT = 200;

interface MealLogRow {
  id: string;
  logged_at: string;
  meal_context: MealContext;
  source: MealSource;
  image_thumb: string | null;
  nutrition: NutritionData;
}

function toEntry(row: MealLogRow): MealHistoryEntry {
  return {
    id: row.id,
    timestamp: new Date(row.logged_at).getTime(),
    mealContext: row.meal_context,
    source: row.source,
    imagePreview: row.image_thumb ?? undefined,
    nutritionData: row.nutrition,
  };
}

/** Coerce a model-supplied value to a number, defaulting rather than throwing. */
function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * The denormalized macro columns that Phase 5 aggregates over. Derived here
 * rather than by a generated column so a non-numeric value from the model
 * degrades to 0 instead of failing the insert and losing the meal.
 */
function macroColumns(nutrition: NutritionData) {
  return {
    calories: num(nutrition?.calories?.estimate),
    protein_g: num(nutrition?.macronutrients?.protein_g),
    carbs_g: num(nutrition?.macronutrients?.carbohydrates_g),
    fat_g: num(nutrition?.macronutrients?.fat_g),
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const limit = Number(request.nextUrl.searchParams.get("limit")) || DEFAULT_LIMIT;

    const { data, error } = await supabase
      .from("meal_log")
      .select("id, logged_at, meal_context, source, image_thumb, nutrition")
      .order("logged_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Failed to fetch history:", error);
      return NextResponse.json(
        { error: "Failed to fetch history" },
        { status: 500 }
      );
    }

    return NextResponse.json((data ?? []).map(toEntry));
  } catch (error) {
    console.error("Failed to fetch history:", error);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mealContext, nutritionData, imagePreview, source, timestamp } = body;

    if (!mealContext || !nutritionData) {
      return NextResponse.json({ error: "Invalid meal entry" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("meal_log")
      .insert({
        meal_context: mealContext,
        source: (source as MealSource) ?? "photo",
        nutrition: nutritionData,
        image_thumb: imagePreview ?? null,
        // Only set when back-entering; otherwise the column default (now) wins.
        ...(timestamp ? { logged_at: new Date(timestamp).toISOString() } : {}),
        ...macroColumns(nutritionData),
      })
      .select("id, logged_at, meal_context, source, image_thumb, nutrition")
      .single();

    if (error) {
      console.error("Failed to save meal:", error);
      return NextResponse.json({ error: "Failed to save meal" }, { status: 500 });
    }

    // The id matters to the caller: re-analysis PATCHes this row rather than
    // silently discarding the corrected result.
    return NextResponse.json(toEntry(data as MealLogRow));
  } catch (error) {
    console.error("Failed to save meal:", error);
    return NextResponse.json({ error: "Failed to save meal" }, { status: 500 });
  }
}

/** Replace an existing meal's analysis — used when ingredients are corrected. */
export async function PATCH(request: NextRequest) {
  try {
    const { id, nutritionData } = await request.json();

    if (!id || !nutritionData) {
      return NextResponse.json(
        { error: "Missing meal id or nutrition data" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("meal_log")
      .update({ nutrition: nutritionData, ...macroColumns(nutritionData) })
      .eq("id", id)
      .select("id, logged_at, meal_context, source, image_thumb, nutrition")
      .single();

    if (error) {
      console.error("Failed to update meal:", error);
      return NextResponse.json(
        { error: "Failed to update meal" },
        { status: 500 }
      );
    }

    return NextResponse.json(toEntry(data as MealLogRow));
  } catch (error) {
    console.error("Failed to update meal:", error);
    return NextResponse.json({ error: "Failed to update meal" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing meal ID" }, { status: 400 });
    }

    const supabase = await createClient();
    const { error } = await supabase.from("meal_log").delete().eq("id", id);

    if (error) {
      console.error("Failed to delete meal:", error);
      return NextResponse.json(
        { error: "Failed to delete meal" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete meal:", error);
    return NextResponse.json({ error: "Failed to delete meal" }, { status: 500 });
  }
}
