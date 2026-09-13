"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { MEAL_CONTEXTS, MealContext, NutritionData } from "@/types/nutrition";
import {
  ImageData,
  compressAndConvertImage,
  createThumbnail,
} from "@/lib/image";
import { useMealHistory } from "@/hooks/useMealHistory";
import AppHeader from "./AppHeader";
import ResultsCard from "./ResultsCard";
import DailySummary from "./DailySummary";

export default function CaptureView() {
  const [selectedContext, setSelectedContext] =
    useState<MealContext>("just-curious");
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [results, setResults] = useState<NutritionData | null>(null);
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Set once the meal is persisted. Re-analysis updates this row rather than
  // discarding the corrected result, which is what the old flow did.
  const [savedMealId, setSavedMealId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { history, saveMeal, updateMeal } = useMealHistory();

  const analyzeImage = async (
    imgData: ImageData,
    ingredientsList?: string[]
  ) => {
    const isCorrection = Boolean(ingredientsList);
    if (isCorrection) setIsReanalyzing(true);
    else setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: imgData.base64,
          mediaType: imgData.mediaType,
          mealContext: selectedContext,
          ingredients: ingredientsList,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const message = errorData.error || "Failed to analyze image";
        throw new Error(
          errorData.detail ? `${message}\n\n${errorData.detail}` : message
        );
      }

      const data: NutritionData = await response.json();
      setResults(data);

      if (isCorrection) {
        if (savedMealId) await updateMeal(savedMealId, data);
      } else {
        setIngredients(data.foods_identified || []);
        const thumbnail = await createThumbnail(imgData.preview);
        const saved = await saveMeal({
          mealContext: selectedContext,
          nutritionData: data,
          imagePreview: thumbnail,
        });
        if (saved) setSavedMealId(saved.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsAnalyzing(false);
      setIsReanalyzing(false);
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSavedMealId(null);

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    try {
      const compressed = await compressAndConvertImage(file);
      setImageData(compressed);
      await analyzeImage(compressed);
    } catch {
      setError("Failed to process image. Please try again.");
    }
  };

  const handleReset = () => {
    setImageData(null);
    setResults(null);
    setIngredients([]);
    setError(null);
    setSavedMealId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Results view
  if (results) {
    return (
      <div className="min-h-dvh bg-background">
        <div className="max-w-md mx-auto px-4 py-6">
          <AppHeader historyCount={history.length} />

          {imageData && (
            <div className="mb-4 rounded-2xl overflow-hidden">
              <img
                src={imageData.preview}
                alt="Your meal"
                className="w-full h-48 object-cover"
              />
            </div>
          )}

          <ResultsCard
            data={results}
            ingredients={ingredients}
            onIngredientsUpdate={setIngredients}
            onReanalyze={() =>
              imageData && analyzeImage(imageData, ingredients)
            }
            isReanalyzing={isReanalyzing}
            onReset={handleReset}
          />
        </div>
      </div>
    );
  }

  // Capture view
  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <div className="max-w-md mx-auto px-4 py-6 flex-1 flex flex-col w-full">
        <AppHeader historyCount={history.length} size="large" />

        <div className="flex-1 flex flex-col justify-center">
          {isAnalyzing ? (
            <div className="text-center space-y-4">
              {imageData && (
                <div className="rounded-2xl overflow-hidden mb-6">
                  <img
                    src={imageData.preview}
                    alt="Your meal"
                    className="w-full h-64 object-cover"
                  />
                </div>
              )}
              <div className="flex justify-center">
                <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-muted">Analyzing your meal...</p>
            </div>
          ) : (
            <>
              <DailySummary meals={history} />

              <div className="text-center mb-8">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageSelect}
                  className="sr-only"
                  aria-label="Take photo or select from library"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-32 h-32 rounded-full bg-accent hover:bg-accent-muted transition-colors flex items-center justify-center mx-auto shadow-lg shadow-accent/20"
                  aria-label="Capture meal photo"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="w-12 h-12 text-background"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z"
                    />
                  </svg>
                </button>
                <p className="mt-4 text-muted">Tap to photograph your meal</p>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 text-center">
                  <p className="text-red-400 text-sm whitespace-pre-wrap break-words text-left">
                    {error}
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <p className="text-sm text-muted text-center">
                  What&apos;s this meal for?
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {MEAL_CONTEXTS.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setSelectedContext(value)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                        selectedContext === value
                          ? "bg-accent text-background"
                          : "bg-card border border-card-border text-foreground hover:bg-card-border"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <footer className="text-center pt-8 space-y-2">
          <div className="flex justify-center gap-4">
            <Link
              href="/plans"
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              Plans
            </Link>
            <Link
              href="/settings"
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              Settings
            </Link>
          </div>
          <p className="text-xs text-muted">Powered by AI vision analysis</p>
        </footer>
      </div>
    </div>
  );
}
