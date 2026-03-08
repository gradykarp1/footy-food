"use client";

import { useState } from "react";

interface IngredientsEditorProps {
  ingredients: string[];
  onUpdate: (ingredients: string[]) => void;
  onReanalyze: () => void;
  isAnalyzing: boolean;
}

export default function IngredientsEditor({
  ingredients,
  onUpdate,
  onReanalyze,
  isAnalyzing,
}: IngredientsEditorProps) {
  const [newIngredient, setNewIngredient] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const handleRemove = (index: number) => {
    const updated = ingredients.filter((_, i) => i !== index);
    onUpdate(updated);
  };

  const handleAdd = () => {
    const trimmed = newIngredient.trim();
    if (trimmed && !ingredients.includes(trimmed)) {
      onUpdate([...ingredients, trimmed]);
      setNewIngredient("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="bg-card border border-card-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-muted">Ingredients</h3>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="text-xs text-accent hover:text-accent-muted transition-colors"
        >
          {isEditing ? "Done" : "Edit"}
        </button>
      </div>

      {/* Ingredient chips */}
      <div className="flex flex-wrap gap-2 mb-3">
        {ingredients.map((item, index) => (
          <div
            key={index}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm ${
              isEditing
                ? "bg-background border border-card-border"
                : "bg-background/50"
            }`}
          >
            <span>{item}</span>
            {isEditing && (
              <button
                onClick={() => handleRemove(index)}
                className="ml-1 w-4 h-4 flex items-center justify-center text-red-400 hover:text-red-300 transition-colors"
                aria-label={`Remove ${item}`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-4 h-4"
                >
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add ingredient input */}
      {isEditing && (
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newIngredient}
            onChange={(e) => setNewIngredient(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add ingredient..."
            className="flex-1 px-3 py-2 bg-background border border-card-border rounded-lg text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
          />
          <button
            onClick={handleAdd}
            disabled={!newIngredient.trim()}
            className="px-4 py-2 bg-accent text-background rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent-muted transition-colors"
          >
            Add
          </button>
        </div>
      )}

      {/* Re-analyze button */}
      {isEditing && (
        <button
          onClick={onReanalyze}
          disabled={isAnalyzing || ingredients.length === 0}
          className="w-full py-2.5 bg-accent text-background rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent-muted transition-colors flex items-center justify-center gap-2"
        >
          {isAnalyzing ? (
            <>
              <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
              Re-analyzing...
            </>
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-4 h-4"
              >
                <path
                  fillRule="evenodd"
                  d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z"
                  clipRule="evenodd"
                />
              </svg>
              Re-analyze with updated ingredients
            </>
          )}
        </button>
      )}
    </div>
  );
}
