function parseBooleanEnv(
  value: string | undefined,
  fallback: boolean,
): boolean {
  if (value === undefined) return fallback;
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  return fallback;
}

export function DemoNotice({ compact = false }: { compact?: boolean }) {
  const demoMode = parseBooleanEnv(process.env.NEXT_PUBLIC_DEMO_MODE, true);

  return (
    <section
      aria-label="Demo safety notice"
      className={[
        "rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700 shadow-sm",
        "dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300",
        compact ? "" : "sm:p-5",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="inline-flex items-center rounded-full bg-zinc-950 px-2.5 py-1 text-xs font-semibold text-white dark:bg-white dark:text-zinc-950">
          {demoMode ? "Demo Mode" : "Local mode"}
        </span>
        <p className="font-medium text-zinc-950 dark:text-zinc-50">
          Fictional data only. No login. No HR system connection.
        </p>
      </div>

      <ul className="mt-3 list-disc space-y-1 pl-5">
        <li>
          This demo is decision support for PTO coverage readiness, not record
          keeping.
        </li>
        <li>
          Any approve, defer, or ask-for-coverage actions are non-persistent.
        </li>
        <li>Refreshing the page resets the demo state.</li>
      </ul>
    </section>
  );
}
