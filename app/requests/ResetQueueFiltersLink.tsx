"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps, MouseEvent } from "react";

import { useBrowserDecisions } from "../_components/BrowserDecisionProvider";

type ResetQueueFiltersLinkProps = Omit<
  ComponentProps<typeof Link>,
  "href" | "onClick"
> & {
  href: string;
};

export function ResetQueueFiltersLink({
  href,
  ...props
}: ResetQueueFiltersLinkProps) {
  const router = useRouter();
  const { clearDecisionFilter } = useBrowserDecisions();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return;
    }

    event.preventDefault();
    clearDecisionFilter();
    router.push(href);
  };

  return <Link href={href} onClick={handleClick} {...props} />;
}
