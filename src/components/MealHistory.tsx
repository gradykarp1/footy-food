"use client";

import { useState } from "react";
import Link from "next/link";
import { MealHistoryEntry, MEAL_CONTEXTS } from "@/types/nutrition";

interface MealHistoryProps {
  history: MealHistoryEntry[];
  onDeleteMeal: (id: string) => void;
}

interface DayGroup {
  dateKey: string;
  label: string;
  meals: MealHistoryEntry[];
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

function groupMealsByDay(meals: MealHistoryEntry[]): DayGroup[] {
  const groups: Map<string, MealHistoryEntry[]> = new Map();

  meals.forEach((meal) => {
    const date = new Date(meal.timestamp);
    const dateKey = date.toDateString();

    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(meal);
  });

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  return Array.from(groups.entries()).map(([dateKey, dayMeals]) => {
    const date = new Date(dayMeals[0].timestamp);
    let label: string;

    if (date.toDateString() === today.toDateString()) {
      label = "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      label = "Yesterday";
    } else {
      label = date.toLocaleDateString([], {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
    }

    const totals = dayMeals.reduce(
      (acc, meal) => ({
        calories: acc.calories + (meal.nutritionData.calories?.estimate || 0),
        protein:
          acc.protein + (meal.nutritionData.macronutrients?.protein_g || 0),
        carbs:
          acc.carbs + (meal.nutritionData.macronutrients?.carbohydrates_g || 0),
        fat: acc.fat + (meal.nutritionData.macronutrients?.fat_g || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    return { dateKey, label, meals: dayMeals, totals };
  });
}

export default function MealHistory({
  history,
  onDeleteMeal,
}: MealHistoryProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const dayGroups = groupMealsByDay(history);

  const formatTime = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });

  const getContextLabel = (context: string) =>
    MEAL_CONTEXTS.find((c) => c.value === context)?.label || context;

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await onDeleteMeal(id);
    setDeletingId(null);
  };

  if (history.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-card flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-8 h-8 text-muted"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <p className="text-muted">No meals logged yet</p>
        <p className="text-sm text-muted mt-1">
          Your analyzed meals will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {dayGroups.map((group) => (
        <div key={group.dateKey}>
          {/* Day header with totals */}
          <div className="mb-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                {group.label}
              </h2>
              <span className="text-sm text-muted">
                {group.meals.length} meal{group.meals.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex gap-4 mt-1 text-xs text-muted">
              <span>{Math.round(group.totals.calories)} kcal</span>
              <span>{Math.round(group.totals.protein)}g protein</span>
              <span>{Math.round(group.totals.carbs)}g carbs</span>
              <span>{Math.round(group.totals.fat)}g fat</span>
            </div>
          </div>

          {/* Meals for this day. The delete control is a sibling of the link,
              not a descendant — a button inside a button (or inside an anchor)
              is invalid markup and swallows the nested click. */}
          <div className="space-y-2">
            {group.meals.map((entry) => (
              <div
                key={entry.id}
                className="relative bg-card border border-card-border rounded-xl hover:border-accent/50 transition-colors"
              >
                <Link href={`/history/${entry.id}`} className="flex gap-3 p-3">
                  {entry.imagePreview && (
                    <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
                      <img
                        src={entry.imagePreview}
                        alt={entry.nutritionData.meal_title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-foreground truncate text-sm">
                        {entry.nutritionData.meal_title}
                      </h3>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-base font-bold text-accent">
                          {entry.nutritionData.soccer_performance_rating.score}
                        </span>
                        <span className="text-xs text-muted">/10</span>
                      </div>
                    </div>

                    <p className="text-xs text-muted mt-0.5">
                      {entry.nutritionData.calories.estimate} kcal
                    </p>

                    {/* pr-8 keeps this clear of the delete button */}
                    <div className="flex items-center gap-2 mt-1.5 pr-8">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-background text-muted">
                        {getContextLabel(entry.mealContext)}
                      </span>
                      <span className="text-xs text-muted">
                        {formatTime(entry.timestamp)}
                      </span>
                    </div>
                  </div>
                </Link>

                <button
                  onClick={() => handleDelete(entry.id)}
                  disabled={deletingId === entry.id}
                  className="absolute bottom-2 right-2 p-1.5 text-muted hover:text-red-400 transition-colors"
                  aria-label={`Delete ${entry.nutritionData.meal_title}`}
                >
                  {deletingId === entry.id ? (
                    <div className="w-4 h-4 border-2 border-muted border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-4 h-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                      />
                    </svg>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
