import type { ReactNode } from "react";

import Link from "next/link";

type SafeStateTone = "neutral" | "info" | "caution" | "danger";
type SafeStateRole = "status" | "alert";

type SafeStateAction = {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
};

type SafeStatePanelProps = {
  label: string;
  title: string;
  description: string;
  tone?: SafeStateTone;
  role?: SafeStateRole;
  ariaLive?: "off" | "polite" | "assertive";
  actions: SafeStateAction[];
  bullets?: string[];
  children?: ReactNode;
};

function panelClasses(tone: SafeStateTone): string {
  if (tone === "danger") {
    return "border-red-200 bg-red-50 text-red-950 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-50";
  }
  if (tone === "caution") {
    return "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-50";
  }
  if (tone === "info") {
    return "border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-50";
  }
  return "border-zinc-200 bg-white text-zinc-950 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-50";
}

function eyebrowClasses(tone: SafeStateTone): string {
  if (tone === "danger") {
    return "bg-red-100 text-red-900 dark:bg-red-900/50 dark:text-red-100";
  }
  if (tone === "caution") {
    return "bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100";
  }
  if (tone === "info") {
    return "bg-blue-100 text-blue-900 dark:bg-blue-900/50 dark:text-blue-100";
  }
  return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";
}

function actionClasses(variant: "primary" | "secondary"): string {
  if (variant === "secondary") {
    return "border border-zinc-200 bg-white text-zinc-950 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950/20 dark:text-zinc-50 dark:hover:bg-zinc-900";
  }

  return "bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200";
}

export function SafeStatePanel({
  label,
  title,
  description,
  tone = "neutral",
  role,
  ariaLive = "off",
  actions,
  bullets = [],
  children,
}: SafeStatePanelProps) {
  return (
    <section
      aria-label={label}
      aria-live={ariaLive}
      role={role}
      className={[
        "rounded-2xl border p-5 shadow-sm sm:p-6",
        panelClasses(tone),
      ].join(" ")}
    >
      <span
        className={[
          "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
          eyebrowClasses(tone),
        ].join(" ")}
      >
        {label}
      </span>
      <h2 className="mt-4 text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        {description}
      </p>

      {children ? <div className="mt-4">{children}</div> : null}

      {bullets.length > 0 ? (
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          {bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        {actions.map((action) => (
          <Link
            key={`${action.href}:${action.label}`}
            href={action.href}
            className={[
              "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition",
              actionClasses(action.variant ?? "primary"),
            ].join(" ")}
          >
            {action.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

export function LoadingStateSkeleton({
  cards = 3,
  className = "",
}: {
  cards?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={["grid gap-3 sm:grid-cols-2 lg:grid-cols-3", className].join(
        " ",
      )}
    >
      {Array.from({ length: cards }, (_, index) => (
        <div
          key={`skeleton-${index}`}
          className="animate-pulse rounded-xl border border-zinc-200/80 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/30"
        >
          <div className="h-3 w-24 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          <div className="mt-4 h-7 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          <div className="mt-4 h-3 w-full rounded-full bg-zinc-200 dark:bg-zinc-800" />
          <div className="mt-2 h-3 w-4/5 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        </div>
      ))}
    </div>
  );
}
