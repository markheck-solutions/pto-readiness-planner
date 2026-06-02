import type {
  DemoCoverageBand,
  DemoRecommendation,
} from "../../src/demo/dataset";

function bandLabel(band: DemoCoverageBand): string {
  if (band === "critical") return "Critical";
  if (band === "risky") return "Risky";
  if (band === "thin") return "Thin";
  return "Healthy";
}

function bandClasses(band: DemoCoverageBand): string {
  if (band === "critical")
    return "border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-100";
  if (band === "risky")
    return "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100";
  if (band === "thin")
    return "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-100";
  return "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100";
}

function recommendationLabel(recommendation: DemoRecommendation): string {
  if (recommendation === "approve") return "Approve";
  if (recommendation === "approve_with_coverage_actions")
    return "Approve with coverage actions";
  if (recommendation === "needs_discussion") return "Needs discussion";
  return "Defer";
}

function recommendationClasses(recommendation: DemoRecommendation): string {
  if (recommendation === "defer")
    return "border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-100";
  if (recommendation === "needs_discussion")
    return "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100";
  if (recommendation === "approve_with_coverage_actions")
    return "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-100";
  return "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100";
}

export function RiskBadge({
  band,
  score,
}: {
  band: DemoCoverageBand;
  score?: number;
}) {
  const label = bandLabel(band);

  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold",
        bandClasses(band),
      ].join(" ")}
      aria-label={
        score === undefined
          ? `Risk band: ${label}`
          : `Risk band: ${label}. Score ${score} out of 100.`
      }
    >
      <span>{label}</span>
      {score === undefined ? null : (
        <span className="font-mono tabular-nums opacity-80">{score}</span>
      )}
    </span>
  );
}

export function RecommendationBadge({
  recommendation,
}: {
  recommendation: DemoRecommendation;
}) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
        recommendationClasses(recommendation),
      ].join(" ")}
      aria-label={`Recommendation: ${recommendationLabel(recommendation)}`}
    >
      {recommendationLabel(recommendation)}
    </span>
  );
}
