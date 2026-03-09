"use client";

import { useState } from "react";

interface LoginFormProps {
  onSuccess: () => void;
}

export default function LoginForm({ onSuccess }: LoginFormProps) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, pin }),
      });

      if (response.ok) {
        // Store auth status in localStorage
        localStorage.setItem("footy-food-auth", "true");
        onSuccess();
      } else {
        const data = await response.json();
        setError(data.error || "Login failed");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground">Footy Food</h1>
          <p className="text-muted mt-1">Your Personal Nutrition Coach</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-muted mb-2"
            >
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              required
              autoComplete="username"
              className="w-full px-4 py-3 bg-card border border-card-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          <div>
            <label
              htmlFor="pin"
              className="block text-sm font-medium text-muted mb-2"
            >
              PIN
            </label>
            <input
              id="pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter your PIN"
              required
              autoComplete="current-password"
              className="w-full px-4 py-3 bg-card border border-card-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-center">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !name || !pin}
            className="w-full py-3 bg-accent text-background rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent-muted transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
                Logging in...
              </>
            ) : (
              "Log In"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
