"use client";

interface MacroChartProps {
  protein: number;
  carbs: number;
  fat: number;
}

export default function MacroChart({ protein, carbs, fat }: MacroChartProps) {
  const total = protein + carbs + fat;

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-40">
        <span className="text-muted">No macro data</span>
      </div>
    );
  }

  // Calculate percentages
  const proteinPct = (protein / total) * 100;
  const carbsPct = (carbs / total) * 100;
  const fatPct = (fat / total) * 100;

  // SVG donut chart calculations
  const size = 120;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Calculate stroke dash arrays for each segment
  const proteinDash = (proteinPct / 100) * circumference;
  const carbsDash = (carbsPct / 100) * circumference;
  const fatDash = (fatPct / 100) * circumference;

  // Calculate rotation offsets (starting from top, going clockwise)
  const proteinOffset = 0;
  const carbsOffset = proteinDash;
  const fatOffset = proteinDash + carbsDash;

  return (
    <div className="flex items-center gap-6">
      {/* Donut Chart */}
      <div className="relative">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#262626"
            strokeWidth={strokeWidth}
          />

          {/* Protein segment (blue) */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={strokeWidth}
            strokeDasharray={`${proteinDash} ${circumference}`}
            strokeDashoffset={-proteinOffset}
            strokeLinecap="round"
          />

          {/* Carbs segment (green) */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#22c55e"
            strokeWidth={strokeWidth}
            strokeDasharray={`${carbsDash} ${circumference}`}
            strokeDashoffset={-carbsOffset}
            strokeLinecap="round"
          />

          {/* Fat segment (yellow) */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#eab308"
            strokeWidth={strokeWidth}
            strokeDasharray={`${fatDash} ${circumference}`}
            strokeDashoffset={-fatOffset}
            strokeLinecap="round"
          />
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold">{total}g</span>
          <span className="text-xs text-muted">total</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-2 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-muted">Protein</span>
          <span className="font-medium ml-auto">{protein}g</span>
          <span className="text-muted text-xs w-10 text-right">
            {proteinPct.toFixed(0)}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-muted">Carbs</span>
          <span className="font-medium ml-auto">{carbs}g</span>
          <span className="text-muted text-xs w-10 text-right">
            {carbsPct.toFixed(0)}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span className="text-muted">Fat</span>
          <span className="font-medium ml-auto">{fat}g</span>
          <span className="text-muted text-xs w-10 text-right">
            {fatPct.toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
}
