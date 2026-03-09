"use client";

import { NutritionData } from "@/types/nutrition";
import MacroChart from "./MacroChart";
import IngredientsEditor from "./IngredientsEditor";

interface ResultsCardProps {
  data: NutritionData;
  ingredients: string[];
  onIngredientsUpdate: (ingredients: string[]) => void;
  onReanalyze: () => void;
  isReanalyzing: boolean;
  onReset: () => void;
  isViewingHistory?: boolean;
}

export default function ResultsCard({
  data,
  ingredients,
  onIngredientsUpdate,
  onReanalyze,
  isReanalyzing,
  onReset,
  isViewingHistory = false,
}: ResultsCardProps) {
  const { score, out_of, summary } = data.soccer_performance_rating;

  return (
    <div className="w-full space-y-4 pb-8">
      {/* Header with score */}
      <div className="bg-card border border-card-border rounded-2xl p-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold">{data.meal_title}</h2>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-3xl font-bold text-accent">
              {score}
              <span className="text-lg text-muted">/{out_of}</span>
            </div>
            <span className="text-xs text-muted">Performance</span>
          </div>
        </div>
        <p className="mt-3 text-sm text-foreground/80">{summary}</p>
        <div className="mt-2 flex items-center gap-2">
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              data.confidence === "high"
                ? "bg-green-500/20 text-green-400"
                : data.confidence === "medium"
                  ? "bg-yellow-500/20 text-yellow-400"
                  : "bg-red-500/20 text-red-400"
            }`}
          >
            {data.confidence} confidence
          </span>
        </div>
      </div>

      {/* Ingredients - editable only for new analysis, read-only for history */}
      {isViewingHistory ? (
        <div className="bg-card border border-card-border rounded-2xl p-4">
          <h3 className="text-sm font-medium text-muted mb-3">Ingredients</h3>
          <div className="flex flex-wrap gap-2">
            {ingredients.map((item, index) => (
              <span
                key={index}
                className="px-3 py-1.5 rounded-full text-sm bg-background/50"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <IngredientsEditor
          ingredients={ingredients}
          onUpdate={onIngredientsUpdate}
          onReanalyze={onReanalyze}
          isAnalyzing={isReanalyzing}
        />
      )}

      {/* Calories */}
      <div className="bg-card border border-card-border rounded-2xl p-4">
        <h3 className="text-sm font-medium text-muted mb-2">Calories</h3>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold">{data.calories.estimate}</span>
          <span className="text-muted text-sm">kcal</span>
          <span className="text-muted text-xs ml-auto">
            Range: {data.calories.range}
          </span>
        </div>
      </div>

      {/* Macros */}
      <div className="bg-card border border-card-border rounded-2xl p-4">
        <h3 className="text-sm font-medium text-muted mb-3">Macronutrients</h3>
        <MacroChart
          protein={data.macronutrients.protein_g}
          carbs={data.macronutrients.carbohydrates_g}
          fat={data.macronutrients.fat_g}
        />
        <div className="mt-4 flex justify-between text-sm text-muted">
          <span>Fiber: {data.macronutrients.fiber_g}g</span>
          <span>Sugar: {data.macronutrients.sugar_g}g</span>
        </div>
      </div>

      {/* Key Micronutrients */}
      <div className="bg-card border border-card-border rounded-2xl p-4">
        <h3 className="text-sm font-medium text-muted mb-3">
          Key Micronutrients
        </h3>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="bg-background rounded-lg p-2 text-center">
            <div className="font-medium">{data.micronutrients.iron_mg}mg</div>
            <div className="text-xs text-muted">Iron</div>
          </div>
          <div className="bg-background rounded-lg p-2 text-center">
            <div className="font-medium">
              {data.micronutrients.calcium_mg}mg
            </div>
            <div className="text-xs text-muted">Calcium</div>
          </div>
          <div className="bg-background rounded-lg p-2 text-center">
            <div className="font-medium">
              {data.micronutrients.vitamin_d_iu}IU
            </div>
            <div className="text-xs text-muted">Vitamin D</div>
          </div>
          <div className="bg-background rounded-lg p-2 text-center">
            <div className="font-medium">
              {data.micronutrients.potassium_mg}mg
            </div>
            <div className="text-xs text-muted">Potassium</div>
          </div>
          <div className="bg-background rounded-lg p-2 text-center">
            <div className="font-medium">
              {data.micronutrients.vitamin_c_mg}mg
            </div>
            <div className="text-xs text-muted">Vitamin C</div>
          </div>
          <div className="bg-background rounded-lg p-2 text-center">
            <div className="font-medium">
              {data.micronutrients.magnesium_mg}mg
            </div>
            <div className="text-xs text-muted">Magnesium</div>
          </div>
        </div>
      </div>

      {/* Hydration */}
      {data.hydration_note && (
        <div className="bg-card border border-card-border rounded-2xl p-4">
          <h3 className="text-sm font-medium text-muted mb-2">Hydration</h3>
          <p className="text-sm">{data.hydration_note}</p>
        </div>
      )}

      {/* Strengths */}
      <div className="bg-card border border-card-border rounded-2xl p-4">
        <h3 className="text-sm font-medium text-green-400 mb-2">
          What This Meal Does Well
        </h3>
        <ul className="space-y-1">
          {data.what_this_meal_does_well.map((item, i) => (
            <li key={i} className="text-sm flex items-start gap-2">
              <span className="text-green-400 mt-0.5">+</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Suggestions */}
      <div className="bg-card border border-card-border rounded-2xl p-4">
        <h3 className="text-sm font-medium text-blue-400 mb-2">
          Add Next Time
        </h3>
        <ul className="space-y-1">
          {data.what_to_add_next_time.map((item, i) => (
            <li key={i} className="text-sm flex items-start gap-2">
              <span className="text-blue-400 mt-0.5">+</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Timing Feedback */}
      <div className="bg-card border border-card-border rounded-2xl p-4">
        <h3 className="text-sm font-medium text-muted mb-3">
          Timing Recommendations
        </h3>
        <div className="space-y-3 text-sm">
          <div>
            <span className="text-accent font-medium">Pre-Match:</span>
            <p className="text-foreground/80 mt-0.5">
              {data.meal_timing_feedback.pre_match}
            </p>
          </div>
          <div>
            <span className="text-accent font-medium">Post-Match:</span>
            <p className="text-foreground/80 mt-0.5">
              {data.meal_timing_feedback.post_match}
            </p>
          </div>
          <div>
            <span className="text-accent font-medium">Rest Day:</span>
            <p className="text-foreground/80 mt-0.5">
              {data.meal_timing_feedback.rest_day}
            </p>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-muted text-center px-4">{data.disclaimer}</p>

      {/* Analyze Another */}
      <button
        onClick={onReset}
        className="w-full py-3 bg-card border border-card-border rounded-xl text-foreground font-medium hover:bg-card-border transition-colors"
      >
        Analyze Another Meal
      </button>
    </div>
  );
}
