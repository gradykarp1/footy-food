export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export interface ScheduleEntry {
  day_of_week: number;
  activity: string;
  start_time: string | null;
  duration_minutes: number | null;
}

/** 18:30 -> 6:30 PM. Stored 24h, read by humans in local convention. */
export function friendlyTime(value: string | null): string {
  if (!value) return "";
  const [h, m] = value.slice(0, 5).split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

/**
 * Renders the saved template as editable text for the weekly plan form. The
 * template is a default, not a fixture list — practice counts move week to
 * week, so this is a starting point the parent adjusts before generating.
 */
export function scheduleToText(entries: ScheduleEntry[]): string {
  return DAY_NAMES.map((day, index) => {
    const forDay = entries
      .filter((e) => e.day_of_week === index)
      .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));

    if (forDay.length === 0) return `${day}: rest`;

    const parts = forDay.map((e) => {
      const time = friendlyTime(e.start_time);
      const length = e.duration_minutes ? `${e.duration_minutes} min` : "";
      const detail = [time, length].filter(Boolean).join(", ");
      return detail ? `${e.activity} at ${detail}` : e.activity;
    });

    return `${day}: ${parts.join("; ")}`;
  }).join("\n");
}

/** Next occurrence of Monday, as the default week to plan. */
export function nextMonday(): string {
  const d = new Date();
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
}
