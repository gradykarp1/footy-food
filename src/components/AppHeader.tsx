"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface AppHeaderProps {
  historyCount: number;
  /** Larger title on the capture screen, compact elsewhere. */
  size?: "large" | "compact";
  /** Hide the history button when already on a history screen. */
  showHistoryLink?: boolean;
}

export default function AppHeader({
  historyCount,
  size = "compact",
  showHistoryLink = true,
}: AppHeaderProps) {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    router.push("/login");
  };

  return (
    <header className="flex items-center justify-between mb-6">
      <button
        onClick={handleSignOut}
        className="w-10 h-10 flex items-center justify-center text-muted hover:text-foreground transition-colors"
        aria-label="Sign out"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-5 h-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75"
          />
        </svg>
      </button>

      <Link href="/" className="text-center">
        <h1
          className={`font-bold text-foreground ${
            size === "large" ? "text-3xl" : "text-2xl"
          }`}
        >
          Footy Food
        </h1>
        <p className={`text-muted ${size === "large" ? "mt-1" : "text-sm"}`}>
          Your Personal Nutrition Coach
        </p>
      </Link>

      {showHistoryLink ? (
        <Link
          href="/history"
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
          {historyCount > 0 && (
            <span className="absolute top-0 right-0 w-5 h-5 bg-accent text-background text-xs font-bold rounded-full flex items-center justify-center">
              {historyCount > 99 ? "99+" : historyCount}
            </span>
          )}
        </Link>
      ) : (
        <div className="w-10" />
      )}
    </header>
  );
}
