import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

import { BrowserDecisionProvider } from "./_components/BrowserDecisionProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PTO Coverage Readiness Planner (Demo)",
  description:
    "No-login manager decision support demo for PTO coverage readiness using fictional data only.",
};

function parseBooleanEnv(
  value: string | undefined,
  fallback: boolean,
): boolean {
  if (value === undefined) return fallback;
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  return fallback;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const demoMode = parseBooleanEnv(process.env.NEXT_PUBLIC_DEMO_MODE, true);

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow dark:focus:bg-zinc-900"
        >
          Skip to content
        </a>

        <header className="border-b border-zinc-200/70 bg-zinc-50/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/60">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-6 px-6 py-4">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-zinc-50"
              >
                PTO Coverage Readiness
              </Link>
              <span
                className="hidden rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 sm:inline"
                aria-label={
                  demoMode
                    ? "Demo Mode: fictional data only"
                    : "Local mode: fictional data only"
                }
              >
                {demoMode ? "Demo Mode" : "Local mode"}
              </span>
            </div>

            <nav className="flex items-center gap-4 text-sm">
              <Link
                href="/requests"
                className="text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-50"
              >
                Requests
              </Link>
              <Link
                href="/heatmap"
                className="text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-50"
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
          </div>
        </header>

        <main id="main" className="flex-1">
          <BrowserDecisionProvider>{children}</BrowserDecisionProvider>
        </main>

        <footer className="border-t border-zinc-200/70 dark:border-zinc-800">
          <div className="mx-auto w-full max-w-5xl px-6 py-6 text-xs text-zinc-600 dark:text-zinc-400">
            Fictional data only. No login. No HR system connection. This demo is
            for PTO coverage readiness discussion, not record keeping.
          </div>
        </footer>
      </body>
    </html>
  );
}
