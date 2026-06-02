"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function linkClass(active: boolean): string {
  return [
    "transition",
    active
      ? "font-semibold text-zinc-950 underline decoration-zinc-400 underline-offset-4 dark:text-zinc-50 dark:decoration-zinc-500"
      : "text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-50",
  ].join(" ");
}

export function HeaderNav() {
  const pathname = usePathname();
  const requestsActive =
    pathname === "/requests" || pathname.startsWith("/requests/");
  const coverageActive = pathname === "/heatmap";

  return (
    <nav aria-label="Primary" className="flex items-center gap-4 text-sm">
      <Link
        href="/requests"
        aria-current={requestsActive ? "page" : undefined}
        className={linkClass(requestsActive)}
      >
        Requests
      </Link>
      <Link
        href="/heatmap"
        aria-current={coverageActive ? "page" : undefined}
        className={linkClass(coverageActive)}
      >
        Coverage
      </Link>
      <a
        href="/api/health"
        className="hidden text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-50 md:inline"
      >
        Health
      </a>
    </nav>
  );
}
