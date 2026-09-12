import Link from "next/link";
import AppHeader from "@/components/AppHeader";

const SECTIONS = [
  {
    href: "/settings/profile",
    title: "Athlete profile",
    body: "Name, weight, position and the typical training week.",
  },
  {
    href: "/settings/preferences",
    title: "Preferences",
    body: "Allergies, likes, dislikes and texture aversions.",
  },
  {
    href: "/settings/guidance",
    title: "Guidance",
    body: "Nutrition documents and the rules extracted from them.",
  },
];

export default function SettingsPage() {
  return (
    <div className="min-h-dvh bg-background">
      <div className="max-w-md mx-auto px-4 py-6">
        <AppHeader historyCount={0} showHistoryLink={false} />

        <h2 className="text-2xl font-bold text-foreground mb-1">Settings</h2>
        <p className="text-sm text-muted mb-6">
          What plans and recipes are built from.
        </p>

        <div className="space-y-3">
          {SECTIONS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="block bg-card border border-card-border rounded-xl p-4 hover:border-accent/50 transition-colors"
            >
              <p className="font-medium text-foreground">{s.title}</p>
              <p className="text-sm text-muted mt-0.5">{s.body}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
