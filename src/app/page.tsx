"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  NutritionData,
  MealContext,
  MEAL_CONTEXTS,
  MealHistoryEntry,
} from "@/types/nutrition";
import ResultsCard from "@/components/ResultsCard";
import LoginForm from "@/components/LoginForm";
import MealHistory from "@/components/MealHistory";

interface ImageData {
  base64: string;
  mediaType: string;
  preview: string;
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [selectedContext, setSelectedContext] =
    useState<MealContext>("just-curious");
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [results, setResults] = useState<NutritionData | null>(null);
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<MealHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [viewingHistoryEntry, setViewingHistoryEntry] =
    useState<MealHistoryEntry | null>(null);
  const [hasSavedCurrentMeal, setHasSavedCurrentMeal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check auth status on mount
  useEffect(() => {
    const authStatus = localStorage.getItem("footy-food-auth");
    setIsAuthenticated(authStatus === "true");
  }, []);

  // Fetch history when authenticated
  const fetchHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/history");
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchHistory();
    }
  }, [isAuthenticated, fetchHistory]);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setHasSavedCurrentMeal(false);

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    // Compress and convert to base64
    try {
      const compressedData = await compressAndConvertImage(file);
      setImageData(compressedData);

      // Automatically start analysis
      await analyzeImage(compressedData);
    } catch {
      setError("Failed to process image. Please try again.");
    }
  };

  const compressAndConvertImage = (file: File): Promise<ImageData> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Create canvas for compression
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Could not get canvas context"));
            return;
          }

          // Resize to max 1024px width while maintaining aspect ratio
          const maxWidth = 1024;
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to base64 (JPEG for better compression)
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          const base64Data = dataUrl.split(",")[1];

          resolve({
            base64: base64Data,
            preview: dataUrl,
            mediaType: "image/jpeg",
          });
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  };

  const createThumbnail = (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve("");
          return;
        }

        // Create a small thumbnail (64px)
        const size = 64;
        canvas.width = size;
        canvas.height = size;

        // Center crop
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;

        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.6));
      };
      img.onerror = () => resolve("");
      img.src = dataUrl;
    });
  };

  const saveMealToHistory = async (
    nutritionData: NutritionData,
    imgData: ImageData
  ) => {
    if (hasSavedCurrentMeal) return;

    try {
      const thumbnail = await createThumbnail(imgData.preview);

      const entry: MealHistoryEntry = {
        id: `meal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        mealContext: selectedContext,
        imagePreview: thumbnail,
        nutritionData,
      };

      const response = await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });

      if (response.ok) {
        setHasSavedCurrentMeal(true);
        setHistory((prev) => [entry, ...prev]);
      } else {
        const errorData = await response.json();
        console.error("Save failed:", errorData);
      }
    } catch (err) {
      console.error("Failed to save meal:", err);
    }
  };

  const analyzeImage = async (
    imgData: ImageData,
    ingredientsList?: string[]
  ) => {
    if (ingredientsList) {
      setIsReanalyzing(true);
    } else {
      setIsAnalyzing(true);
    }
    setError(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: imgData.base64,
          mediaType: imgData.mediaType,
          mealContext: selectedContext,
          ingredients: ingredientsList,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to analyze image");
      }

      const data = await response.json();
      setResults(data);

      // Update ingredients from results (only on initial analysis)
      if (!ingredientsList) {
        setIngredients(data.foods_identified || []);
        // Save to history on initial analysis
        saveMealToHistory(data, imgData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsAnalyzing(false);
      setIsReanalyzing(false);
    }
  };

  const handleReanalyze = () => {
    if (!imageData) return;
    analyzeImage(imageData, ingredients);
  };

  const handleReset = () => {
    setImageData(null);
    setResults(null);
    setIngredients([]);
    setError(null);
    setViewingHistoryEntry(null);
    setHasSavedCurrentMeal(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDeleteMeal = async (id: string) => {
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
  };

  const handleSelectHistoryMeal = (entry: MealHistoryEntry) => {
    setViewingHistoryEntry(entry);
    setResults(entry.nutritionData);
    setIngredients(entry.nutritionData.foods_identified || []);
    setSelectedContext(entry.mealContext);
    setShowHistory(false);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Loading state while checking auth
  if (isAuthenticated === null) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return <LoginForm onSuccess={handleLogin} />;
  }

  // Show history view
  if (showHistory) {
    return (
      <MealHistory
        history={history}
        onSelectMeal={handleSelectHistoryMeal}
        onDeleteMeal={handleDeleteMeal}
        onClose={() => setShowHistory(false)}
      />
    );
  }

  // Show results view
  if (results) {
    return (
      <div className="min-h-dvh bg-background">
        <div className="max-w-md mx-auto px-4 py-6">
          {/* Header with History Button */}
          <header className="flex items-center justify-between mb-6">
            <div className="w-10" />
            <div className="text-center">
              <h1 className="text-2xl font-bold text-foreground">Footy Food</h1>
              <p className="text-sm text-muted">Your Personal Nutrition Coach</p>
            </div>
            <button
              onClick={() => setShowHistory(true)}
              className="relative w-10 h-10 flex items-center justify-center text-muted hover:text-foreground transition-colors"
              aria-label="View meal history"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {history.length > 0 && (
                <span className="absolute -top-0 -right-0 w-5 h-5 bg-accent text-background text-xs font-bold rounded-full flex items-center justify-center">
                  {history.length > 99 ? "99+" : history.length}
                </span>
              )}
            </button>
          </header>

          {/* Image Preview */}
          {(imageData || viewingHistoryEntry?.imagePreview) && (
            <div className="mb-4 rounded-2xl overflow-hidden">
              <img
                src={imageData?.preview || viewingHistoryEntry?.imagePreview}
                alt="Your meal"
                className="w-full h-48 object-cover"
              />
            </div>
          )}

          <ResultsCard
            data={results}
            ingredients={ingredients}
            onIngredientsUpdate={setIngredients}
            onReanalyze={handleReanalyze}
            isReanalyzing={isReanalyzing}
            onReset={handleReset}
            isViewingHistory={!!viewingHistoryEntry}
          />
        </div>
      </div>
    );
  }

  // Main capture view
  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <div className="max-w-md mx-auto px-4 py-6 flex-1 flex flex-col w-full">
        {/* Header with History Button */}
        <header className="flex items-center justify-between mb-8">
          <div className="w-10" /> {/* Spacer for centering */}
          <div className="text-center">
            <h1 className="text-3xl font-bold text-foreground">Footy Food</h1>
            <p className="text-muted mt-1">Your Personal Nutrition Coach</p>
          </div>
          <button
            onClick={() => setShowHistory(true)}
            className="relative w-10 h-10 flex items-center justify-center text-muted hover:text-foreground transition-colors"
            aria-label="View meal history"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {history.length > 0 && (
              <span className="absolute -top-0 -right-0 w-5 h-5 bg-accent text-background text-xs font-bold rounded-full flex items-center justify-center">
                {history.length > 99 ? "99+" : history.length}
              </span>
            )}
          </button>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex flex-col justify-center">
          {/* Loading State */}
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
              {/* Camera Button */}
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
                  onClick={triggerFileInput}
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

              {/* Error Message */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 text-center">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* Context Selector */}
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

        {/* Footer */}
        <footer className="text-center pt-8">
          <p className="text-xs text-muted">Powered by AI vision analysis</p>
        </footer>
      </div>
    </div>
  );
}
