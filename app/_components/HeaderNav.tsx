"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  buildReviewHref,
  readReviewFilterQuery,
  withWeekStartFromDateRange,
} from "../../src/domain/reviewFilters";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestsActive =
    pathname === "/requests" || pathname.startsWith("/requests/");
  const coverageActive = pathname === "/heatmap";
  const reviewQuery = useMemo(
    () => readReviewFilterQuery(searchParams),
    [searchParams],
  );

  useEffect(() => {
    if (!searchParams.has("demoDecision")) return;

    const next = new URLSearchParams(searchParams.toString());
    next.delete("demoDecision");

    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, {
      scroll: false,
    });
  }, [pathname, router, searchParams]);

  const requestsHref = useMemo(
    () => buildReviewHref("/requests", reviewQuery),
    [reviewQuery],
  );
  const coverageHref = useMemo(
    () => buildReviewHref("/heatmap", withWeekStartFromDateRange(reviewQuery)),
    [reviewQuery],
  );

  return (
    <nav aria-label="Primary" className="flex items-center gap-4 text-sm">
      <Link
        href={requestsHref}
        aria-current={requestsActive ? "page" : undefined}
        className={linkClass(requestsActive)}
      >
        Requests
      </Link>
      <Link
        href={coverageHref}
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
