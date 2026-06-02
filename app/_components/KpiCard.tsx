import Link from "next/link";

export function KpiCard({
  label,
  value,
  helper,
  href,
}: {
  label: string;
  value: string;
  helper: string;
  href?: string;
}) {
  const content = (
    <>
      <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {label}
      </div>
      <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        {helper}
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-zinc-700"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
      {content}
    </div>
  );
}
