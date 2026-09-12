"use client";

import { useCallback, useEffect, useState } from "react";
import { MealContext, MealHistoryEntry, NutritionData } from "@/types/nutrition";

interface SaveMealArgs {
  mealContext: MealContext;
  nutritionData: NutritionData;
  imagePreview?: string;
}

export function useMealHistory() {
  const [history, setHistory] = useState<MealHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/history");
      if (response.ok) {
        setHistory(await response.json());
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Insert a meal. Returns the saved entry so the caller can keep its id. */
  const saveMeal = useCallback(
    async (args: SaveMealArgs): Promise<MealHistoryEntry | null> => {
      try {
        const response = await fetch("/api/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(args),
        });

        if (!response.ok) {
          console.error("Save failed:", await response.json());
          return null;
        }

        const saved: MealHistoryEntry = await response.json();
        setHistory((prev) => [saved, ...prev]);
        return saved;
      } catch (err) {
        console.error("Failed to save meal:", err);
        return null;
      }
    },
    []
  );

  /**
   * Overwrite a saved meal's analysis. This is what makes a corrected
   * re-analysis persist instead of being discarded.
   */
  const updateMeal = useCallback(
    async (id: string, nutritionData: NutritionData) => {
      try {
        const response = await fetch("/api/history", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, nutritionData }),
        });

        if (!response.ok) {
          console.error("Update failed:", await response.json());
          return;
        }

        const updated: MealHistoryEntry = await response.json();
        setHistory((prev) =>
          prev.map((entry) => (entry.id === updated.id ? updated : entry))
        );
      } catch (err) {
        console.error("Failed to update meal:", err);
      }
    },
    []
  );

  const deleteMeal = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/history?id=${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setHistory((prev) => prev.filter((entry) => entry.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete meal:", err);
    }
  }, []);

  return { history, isLoading, refresh, saveMeal, updateMeal, deleteMeal };
}
