"use client";

import Link from "next/link";

export function AuthFormShell({
  children,
  description,
  footerHref,
  footerLabel,
  footerText,
  title,
}: {
  children: React.ReactNode;
  description: string;
  footerHref: string;
  footerLabel: string;
  footerText: string;
  title: string;
}) {
  return (
    <main className="min-h-[calc(100vh-88px)] bg-[image:var(--hero-background)] px-6 py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 lg:flex-row lg:items-stretch">
        <section className="flex-1 rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-8 shadow-[var(--shadow-hero)] backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[color:var(--accent-text)]">
            SportsDeck
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[color:var(--foreground)]">
            {title}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-[color:color-mix(in_srgb,var(--foreground)_72%,transparent)]">
            {description}
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-5">
              <p className="text-sm uppercase tracking-[0.22em] text-[color:color-mix(in_srgb,var(--foreground)_55%,transparent)]">
                Match Threads
              </p>
              <p className="mt-3 text-lg font-semibold">Live conversations before and after kickoff.</p>
            </div>
            <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-5">
              <p className="text-sm uppercase tracking-[0.22em] text-[color:color-mix(in_srgb,var(--foreground)_55%,transparent)]">
                Personal Feed
              </p>
              <p className="mt-3 text-lg font-semibold">Follow fans, teams, and the best debates.</p>
            </div>
          </div>
        </section>

        <section className="w-full max-w-xl rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-8 shadow-sm">
          {children}
          <p className="mt-6 text-sm text-[color:color-mix(in_srgb,var(--foreground)_70%,transparent)]">
            {footerText}{" "}
            <Link href={footerHref} className="font-semibold text-[color:var(--accent-text)]">
              {footerLabel}
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
