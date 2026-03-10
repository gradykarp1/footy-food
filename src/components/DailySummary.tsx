"use client";

import { MealHistoryEntry } from "@/types/nutrition";

interface DailySummaryProps {
  meals: MealHistoryEntry[];
}

interface DailyTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealCount: number;
}

function getTodaysMeals(meals: MealHistoryEntry[]): MealHistoryEntry[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStart = today.getTime();

  return meals.filter((meal) => meal.timestamp >= todayStart);
}

function calculateTotals(meals: MealHistoryEntry[]): DailyTotals {
  return meals.reduce(
    (totals, meal) => {
      const { nutritionData } = meal;
      return {
        calories: totals.calories + (nutritionData.calories?.estimate || 0),
        protein: totals.protein + (nutritionData.macronutrients?.protein_g || 0),
        carbs: totals.carbs + (nutritionData.macronutrients?.carbohydrates_g || 0),
        fat: totals.fat + (nutritionData.macronutrients?.fat_g || 0),
        mealCount: totals.mealCount + 1,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, mealCount: 0 }
  );
}

export default function DailySummary({ meals }: DailySummaryProps) {
  const todaysMeals = getTodaysMeals(meals);
  const totals = calculateTotals(todaysMeals);

  if (totals.mealCount === 0) {
    return null;
  }

  return (
    <div className="bg-card border border-card-border rounded-2xl p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-muted">Today&apos;s Nutrition</h2>
        <span className="text-xs text-muted">
          {totals.mealCount} meal{totals.mealCount !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Calories */}
      <div className="mb-4">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold">{Math.round(totals.calories)}</span>
          <span className="text-muted text-sm">kcal</span>
        </div>
      </div>

      {/* Macros row */}
      <div className="flex justify-between text-sm">
        <div className="text-center">
          <div className="flex items-center gap-1.5 justify-center">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="font-medium">{Math.round(totals.protein)}g</span>
          </div>
          <span className="text-xs text-muted">Protein</span>
        </div>
        <div className="text-center">
          <div className="flex items-center gap-1.5 justify-center">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="font-medium">{Math.round(totals.carbs)}g</span>
          </div>
          <span className="text-xs text-muted">Carbs</span>
        </div>
        <div className="text-center">
          <div className="flex items-center gap-1.5 justify-center">
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <span className="font-medium">{Math.round(totals.fat)}g</span>
          </div>
          <span className="text-xs text-muted">Fat</span>
        </div>
      </div>
    </div>
  );
}
