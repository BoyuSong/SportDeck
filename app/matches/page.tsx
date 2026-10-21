"use client";

import { useEffect, useMemo, useState } from "react";
import { MatchCard, type MatchCardMatch } from "@/components/match-card";

type Team = {
  crestUrl: string | null;
  id: number;
  name: string;
  score: number | null;
  shortName: string | null;
};

type MatchesResponse = {
  filters: {
    applied: {
      limit: number;
      matchday: number | null;
      stage: string | null;
      window: "all" | "recent" | "upcoming";
    };
    available: {
      matchdays: number[];
      stages: string[];
    };
  };
  matches: MatchCardMatch[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
  total: number;
};

const PAGE_SIZE = 12;

async function parseJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => null)) as
    | (Record<string, unknown> & T)
    | null;

  if (!response.ok) {
    const message =
      (data && typeof data.error === "string" && data.error) ||
      "Request failed";
    throw new Error(message);
  }

  return (data ?? {}) as T;
}

export default function MatchesPage() {
  const [data, setData] = useState<MatchesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [windowValue, setWindowValue] = useState<"all" | "recent" | "upcoming">(
    "upcoming"
  );
  const [matchday, setMatchday] = useState("");
  const [stage, setStage] = useState("");
  const [page, setPage] = useState(1);

  const searchParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("window", windowValue);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String((page - 1) * PAGE_SIZE));
    if (matchday) params.set("matchday", matchday);
    if (stage) params.set("stage", stage);
    return params.toString();
  }, [matchday, page, stage, windowValue]);

  useEffect(() => {
    setPage(1);
  }, [matchday, stage, windowValue]);

  useEffect(() => {
    async function loadMatches() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/league/matches?${searchParams}`, {
          cache: "no-store",
        });
        const json = await parseJson<MatchesResponse>(response);
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load matches");
      } finally {
        setLoading(false);
      }
    }

    void loadMatches();
  }, [searchParams]);

  return (
    <main className="min-h-[calc(100vh-88px)] bg-[image:var(--hero-background)] px-6 py-10 text-[color:var(--foreground)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <section className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-8 shadow-[var(--shadow-hero)] backdrop-blur">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[color:var(--accent-text)]">
                Match Centre
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight">
                Track every fixture across the league.
              </h1>
              <p className="mt-3 text-base leading-7 text-[color:color-mix(in_srgb,var(--foreground)_72%,transparent)]">
                Browse upcoming kickoffs, catch up on recent results, and move through
                matchdays and competition stages without leaving the page.
              </p>
            </div>

            <div className="grid gap-3 rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-5 py-4 text-sm sm:grid-cols-2">
              <div>
                <p className="uppercase tracking-[0.25em] text-[color:color-mix(in_srgb,var(--foreground)_55%,transparent)]">
                  Showing
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {data ? `${data.pagination.total} fixtures` : "Loading..."}
                </p>
              </div>
              <div>
                <p className="uppercase tracking-[0.25em] text-[color:color-mix(in_srgb,var(--foreground)_55%,transparent)]">
                  Window
                </p>
                <p className="mt-2 text-lg font-semibold capitalize">{windowValue}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <aside className="space-y-6">
            <div className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Browse</h2>

              <div className="mt-5 flex flex-wrap gap-2">
                {[
                  { label: "Upcoming", value: "upcoming" as const },
                  { label: "Recent", value: "recent" as const },
                  { label: "All", value: "all" as const },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setWindowValue(option.value)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      windowValue === option.value
                        ? "bg-[color:var(--surface-strong)] text-[color:var(--surface-strong-foreground)]"
                        : "border border-[color:var(--border)] bg-[color:var(--surface-muted)] text-[color:var(--foreground)] hover:border-[color:var(--accent-text)]"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium">Matchday</label>
                  <select
                    value={matchday}
                    onChange={(event) => setMatchday(event.target.value)}
                    className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3 outline-none transition focus:border-[color:var(--accent-text)]"
                  >
                    <option value="">All matchdays</option>
                    {data?.filters.available.matchdays.map((value) => (
                      <option key={value} value={value}>
                        Matchday {value}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Stage</label>
                  <select
                    value={stage}
                    onChange={(event) => setStage(event.target.value)}
                    className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3 outline-none transition focus:border-[color:var(--accent-text)]"
                  >
                    <option value="">All stages</option>
                    {data?.filters.available.stages.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setWindowValue("upcoming");
                    setMatchday("");
                    setStage("");
                  }}
                  className="w-full rounded-2xl border border-[color:var(--border)] px-4 py-3 text-sm font-medium text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
                >
                  Reset filters
                </button>
              </div>
            </div>
          </aside>

          <section className="space-y-4">
            {loading ? (
              <div className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-8 shadow-sm">
                Loading matches...
              </div>
            ) : error ? (
              <div className="rounded-[2rem] border border-red-300/60 bg-red-100/70 p-8 text-red-800 shadow-sm">
                {error}
              </div>
            ) : !data || data.matches.length === 0 ? (
              <div className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-8 shadow-sm">
                No fixtures match the current filters.
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-3 rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-[color:color-mix(in_srgb,var(--foreground)_68%,transparent)]">
                    Showing {data.matches.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}-
                    {Math.min(page * PAGE_SIZE, data.pagination.total)} of{" "}
                    {data.pagination.total} fixtures
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={page === 1}
                      className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-semibold transition hover:bg-[color:var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Previous
                    </button>
                    <span className="rounded-full bg-[color:var(--surface-muted)] px-4 py-2 text-sm font-semibold">
                      Page {page}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage((current) => current + 1)}
                      disabled={page * PAGE_SIZE >= data.pagination.total}
                      className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-semibold transition hover:bg-[color:var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Next
                    </button>
                  </div>
                </div>

                <div className="grid gap-4">
                  {data.matches.map((match) => (
                    <MatchCard key={match.id} match={match} />
                  ))}
                </div>
              </>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
