"use client";

import { useEffect, useState } from "react";

type StandingsTeam = {
  crest?: string | null;
  id?: number | null;
  name?: string | null;
  shortName?: string | null;
  tla?: string | null;
};

type StandingsRow = {
  draw?: number | null;
  form?: string | null;
  goalDifference?: number | null;
  goalsAgainst?: number | null;
  goalsFor?: number | null;
  lost?: number | null;
  playedGames?: number | null;
  points?: number | null;
  position?: number | null;
  team?: StandingsTeam | null;
  won?: number | null;
};

type StandingsGroup = {
  stage?: string | null;
  table?: StandingsRow[] | null;
  type?: string | null;
};

type StandingsResponse = {
  snapshot: {
    competition: {
      code?: string | null;
      emblem?: string | null;
      id?: number | null;
      name?: string | null;
    } | null;
    competitionCode: string | null;
    fetchedAt: string;
    id: number;
    season: string;
    seasonMeta: {
      currentMatchday?: number | null;
      endDate?: string | null;
      startDate?: string | null;
    } | null;
    source: string | null;
    standings: StandingsGroup[];
  };
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function parseForm(form: string | null | undefined) {
  if (!form) return [];
  return form
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function formBadgeClass(result: string) {
  if (result === "W") {
    return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  }
  if (result === "L") {
    return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
  }
  return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
}

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

function TeamCell({ team }: { team: StandingsTeam | null | undefined }) {
  const name = team?.shortName || team?.tla || team?.name || "Unknown team";

  return (
    <div className="flex items-center gap-3">
      {team?.crest ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={team.crest}
          alt={`${name} crest`}
          className="h-9 w-9 rounded-full border border-[color:var(--border)] bg-white object-contain p-1"
        />
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-muted)] text-[10px] font-bold uppercase">
          {name.slice(0, 3)}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate font-semibold text-[color:var(--foreground)]">{name}</p>
        {team?.name && team.name !== name ? (
          <p className="truncate text-xs text-[color:color-mix(in_srgb,var(--foreground)_60%,transparent)]">
            {team.name}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default function StandingsPage() {
  const [data, setData] = useState<StandingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStandings() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/league/standings", {
          cache: "no-store",
        });
        const json = await parseJson<StandingsResponse>(response);
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load standings");
      } finally {
        setLoading(false);
      }
    }

    void loadStandings();
  }, []);

  const snapshot = data?.snapshot ?? null;
  const primaryTable = snapshot?.standings?.[0]?.table ?? [];

  return (
    <main className="min-h-[calc(100vh-88px)] bg-[image:var(--hero-background)] px-6 py-10 text-[color:var(--foreground)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <section className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-8 shadow-[var(--shadow-hero)] backdrop-blur">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[color:var(--accent-text)]">
                Standings
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight">
                Follow the table as the season shifts.
              </h1>
              <p className="mt-3 text-base leading-7 text-[color:color-mix(in_srgb,var(--foreground)_72%,transparent)]">
                See who is climbing, who is slipping, and how every club stacks up
                on points, goal difference, and recent form.
              </p>
            </div>

            <div className="grid gap-3 rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-5 py-4 text-sm sm:grid-cols-2">
              <div>
                <p className="uppercase tracking-[0.25em] text-[color:color-mix(in_srgb,var(--foreground)_55%,transparent)]">
                  Competition
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {snapshot?.competition?.name || snapshot?.competitionCode || "League table"}
                </p>
              </div>
              <div>
                <p className="uppercase tracking-[0.25em] text-[color:color-mix(in_srgb,var(--foreground)_55%,transparent)]">
                  Updated
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {snapshot ? formatDate(snapshot.fetchedAt) : "Loading..."}
                </p>
              </div>
            </div>
          </div>
        </section>

        {loading ? (
          <section className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-8 shadow-sm">
            Loading standings...
          </section>
        ) : error ? (
          <section className="rounded-[2rem] border border-red-300/60 bg-red-100/70 p-8 text-red-800 shadow-sm">
            {error}
          </section>
        ) : !snapshot || primaryTable.length === 0 ? (
          <section className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-8 shadow-sm">
            No standings data is available yet.
          </section>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm">
                <p className="text-sm uppercase tracking-[0.22em] text-[color:color-mix(in_srgb,var(--foreground)_55%,transparent)]">
                  Season
                </p>
                <p className="mt-3 text-2xl font-semibold">{snapshot.season}</p>
                {snapshot.seasonMeta?.startDate && snapshot.seasonMeta?.endDate ? (
                  <p className="mt-2 text-sm text-[color:color-mix(in_srgb,var(--foreground)_65%,transparent)]">
                    {formatDate(snapshot.seasonMeta.startDate)} to{" "}
                    {formatDate(snapshot.seasonMeta.endDate)}
                  </p>
                ) : null}
              </div>
              <div className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm">
                <p className="text-sm uppercase tracking-[0.22em] text-[color:color-mix(in_srgb,var(--foreground)_55%,transparent)]">
                  Current Matchday
                </p>
                <p className="mt-3 text-2xl font-semibold">
                  {snapshot.seasonMeta?.currentMatchday ?? "N/A"}
                </p>
              </div>
              <div className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm">
                <p className="text-sm uppercase tracking-[0.22em] text-[color:color-mix(in_srgb,var(--foreground)_55%,transparent)]">
                  Source
                </p>
                <p className="mt-3 text-2xl font-semibold">
                  {snapshot.source || "Stored snapshot"}
                </p>
              </div>
            </section>

            <section className="hidden rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] shadow-sm md:block">
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="border-b border-[color:var(--border)] text-left text-xs uppercase tracking-[0.2em] text-[color:color-mix(in_srgb,var(--foreground)_58%,transparent)]">
                      <th className="px-6 py-4">Pos</th>
                      <th className="px-6 py-4">Club</th>
                      <th className="px-4 py-4 text-center">P</th>
                      <th className="px-4 py-4 text-center">W</th>
                      <th className="px-4 py-4 text-center">D</th>
                      <th className="px-4 py-4 text-center">L</th>
                      <th className="px-4 py-4 text-center">GF</th>
                      <th className="px-4 py-4 text-center">GA</th>
                      <th className="px-4 py-4 text-center">GD</th>
                      <th className="px-4 py-4 text-center">Pts</th>
                      <th className="px-6 py-4">Form</th>
                    </tr>
                  </thead>
                  <tbody>
                    {primaryTable.map((row, index) => (
                      <tr
                        key={`${row.team?.id ?? row.team?.name ?? "club"}-${index}`}
                        className="border-b border-[color:color-mix(in_srgb,var(--border)_72%,transparent)] last:border-b-0"
                      >
                        <td className="px-6 py-4 text-sm font-semibold">{row.position ?? index + 1}</td>
                        <td className="px-6 py-4">
                          <TeamCell team={row.team} />
                        </td>
                        <td className="px-4 py-4 text-center text-sm">{row.playedGames ?? "-"}</td>
                        <td className="px-4 py-4 text-center text-sm">{row.won ?? "-"}</td>
                        <td className="px-4 py-4 text-center text-sm">{row.draw ?? "-"}</td>
                        <td className="px-4 py-4 text-center text-sm">{row.lost ?? "-"}</td>
                        <td className="px-4 py-4 text-center text-sm">{row.goalsFor ?? "-"}</td>
                        <td className="px-4 py-4 text-center text-sm">{row.goalsAgainst ?? "-"}</td>
                        <td className="px-4 py-4 text-center text-sm font-semibold">
                          {row.goalDifference ?? "-"}
                        </td>
                        <td className="px-4 py-4 text-center text-sm font-semibold">{row.points ?? "-"}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            {parseForm(row.form).length > 0 ? (
                              parseForm(row.form).map((result, formIndex) => (
                                <span
                                  key={`${row.team?.id ?? index}-${formIndex}`}
                                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${formBadgeClass(result)}`}
                                >
                                  {result}
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-[color:color-mix(in_srgb,var(--foreground)_55%,transparent)]">
                                N/A
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="grid gap-4 md:hidden">
              {primaryTable.map((row, index) => (
                <article
                  key={`mobile-${row.team?.id ?? row.team?.name ?? "club"}-${index}`}
                  className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <TeamCell team={row.team} />
                    <div className="rounded-2xl bg-[color:var(--surface-muted)] px-3 py-2 text-center">
                      <p className="text-xs uppercase tracking-[0.18em] text-[color:color-mix(in_srgb,var(--foreground)_55%,transparent)]">
                        Pos
                      </p>
                      <p className="text-lg font-semibold">{row.position ?? index + 1}</p>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-5 gap-3 text-center text-sm">
                    <div>
                      <p className="text-[color:color-mix(in_srgb,var(--foreground)_55%,transparent)]">Pts</p>
                      <p className="mt-1 font-semibold">{row.points ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-[color:color-mix(in_srgb,var(--foreground)_55%,transparent)]">P</p>
                      <p className="mt-1 font-semibold">{row.playedGames ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-[color:color-mix(in_srgb,var(--foreground)_55%,transparent)]">W</p>
                      <p className="mt-1 font-semibold">{row.won ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-[color:color-mix(in_srgb,var(--foreground)_55%,transparent)]">D</p>
                      <p className="mt-1 font-semibold">{row.draw ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-[color:color-mix(in_srgb,var(--foreground)_55%,transparent)]">L</p>
                      <p className="mt-1 font-semibold">{row.lost ?? "-"}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {parseForm(row.form).length > 0 ? (
                      parseForm(row.form).map((result, formIndex) => (
                        <span
                          key={`mobile-form-${row.team?.id ?? index}-${formIndex}`}
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${formBadgeClass(result)}`}
                        >
                          {result}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-[color:color-mix(in_srgb,var(--foreground)_55%,transparent)]">
                        No recent form available
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
