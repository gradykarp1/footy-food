"use client";

import { use } from "react";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import ResultsCard from "@/components/ResultsCard";
import { useMealHistory } from "@/hooks/useMealHistory";

export default function HistoryMealPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { history, isLoading } = useMealHistory();

  const entry = history.find((meal) => meal.id === id);

  return (
    <div className="min-h-dvh bg-background">
      <div className="max-w-md mx-auto px-4 py-6">
        <AppHeader historyCount={history.length} showHistoryLink={false} />

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !entry ? (
          <div className="text-center py-12">
            <p className="text-muted">This meal is no longer in your history.</p>
            <Link
              href="/history"
              className="inline-block mt-4 px-4 py-2 bg-card border border-card-border rounded-xl text-foreground text-sm"
            >
              Back to history
            </Link>
          </div>
        ) : (
          <>
            {entry.imagePreview && (
              <div className="mb-4 rounded-2xl overflow-hidden">
                <img
                  src={entry.imagePreview}
                  alt={entry.nutritionData.meal_title}
                  className="w-full h-48 object-cover"
                />
              </div>
            )}

            <ResultsCard
              data={entry.nutritionData}
              ingredients={entry.nutritionData.foods_identified || []}
              onIngredientsUpdate={() => {}}
              onReanalyze={() => {}}
              isReanalyzing={false}
              onReset={() => {}}
              isViewingHistory
            />
          </>
        )}
      </div>
    </div>
  );
}
