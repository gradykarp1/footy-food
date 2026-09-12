"use client";

import AppHeader from "@/components/AppHeader";
import MealHistory from "@/components/MealHistory";
import { useMealHistory } from "@/hooks/useMealHistory";

export default function HistoryPage() {
  const { history, isLoading, deleteMeal } = useMealHistory();

  return (
    <div className="min-h-dvh bg-background">
      <div className="max-w-md mx-auto px-4 py-6">
        <AppHeader historyCount={history.length} showHistoryLink={false} />

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground">Meal History</h2>
          <p className="text-sm text-muted">
            {history.length} meal{history.length !== 1 ? "s" : ""} logged
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <MealHistory history={history} onDeleteMeal={deleteMeal} />
        )}
      </div>
    </div>
  );
}
