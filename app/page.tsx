import Link from "next/link";
import { prisma } from "@/prisma/client";

export const dynamic = "force-dynamic";

type LandingData = {
  featuredMatches: Array<{
    awayTeam: {
      crestUrl: string | null;
      name: string;
      shortName: string | null;
    };
    id: number;
    matchday: number | null;
    scoreAway: number | null;
    scoreHome: number | null;
    stage: string | null;
    status: string;
    utcDate: string;
    venue: string | null;
    homeTeam: {
      crestUrl: string | null;
      name: string;
      shortName: string | null;
    };
  }>;
  highlightedThreads: Array<{
    _count: {
      polls: number;
      posts: number;
    };
    id: number;
    tags: string[];
    team: {
      id: number;
      name: string;
      shortName: string | null;
    } | null;
    title: string;
    type: "GENERAL" | "MATCH" | "TEAM";
    updatedAt: string;
  }>;
  stats: {
    activeThreads: number;
    clubs: number;
    completedMatches: number;
    supporters: number;
  };
  standings: Array<{
    points?: number;
    position?: number;
    team?: {
      crest?: string | null;
      name?: string | null;
      shortName?: string | null;
      tla?: string | null;
    };
  }>;
  standingsMeta: {
    competitionName: string | null;
    fetchedAt: string | null;
    season: string | null;
  };
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getStatusLabel(status: string) {
  if (status === "FINISHED") return "Full time";
  if (status === "IN_PLAY") return "Live";
  if (status === "TIMED") return "Scheduled";
  return status.replaceAll("_", " ");
}

function getScoreText(value: number | null) {
  return value === null ? "-" : String(value);
}

async function getLandingData(): Promise<LandingData> {
  const now = new Date();

  const [supporters, clubs, activeThreads, completedMatches, upcomingMatches, recentThreads, latestStandings] =
    await Promise.all([
      prisma.user.count(),
      prisma.team.count(),
      prisma.thread.count({
        where: { status: { not: "HIDDEN" } },
      }),
      prisma.match.count({
        where: {
          utcDate: { lte: now },
        },
      }),
      prisma.match.findMany({
        where: {
          status: { not: "FINISHED" },
        },
        orderBy: { utcDate: "asc" },
        take: 3,
        select: {
          id: true,
          status: true,
          utcDate: true,
          venue: true,
          matchday: true,
          stage: true,
          scoreHome: true,
          scoreAway: true,
          homeTeam: {
            select: {
              name: true,
              shortName: true,
              crestUrl: true,
            },
          },
          awayTeam: {
            select: {
              name: true,
              shortName: true,
              crestUrl: true,
            },
          },
        },
      }),
      prisma.thread.findMany({
        where: {
          status: { not: "HIDDEN" },
        },
        orderBy: { updatedAt: "desc" },
        take: 4,
        select: {
          id: true,
          title: true,
          type: true,
          updatedAt: true,
          team: {
            select: {
              id: true,
              name: true,
              shortName: true,
            },
          },
          tags: {
            select: {
              tag: {
                select: {
                  name: true,
                },
              },
            },
          },
          _count: {
            select: {
              posts: true,
              polls: true,
            },
          },
        },
      }),
      prisma.standingsSnapshot.findFirst({
        orderBy: { fetchedAt: "desc" },
        select: {
          season: true,
          fetchedAt: true,
          data: true,
        },
      }),
    ]);

  const snapshotData =
    latestStandings?.data && typeof latestStandings.data === "object" && !Array.isArray(latestStandings.data)
      ? (latestStandings.data as {
          competition?: { name?: string | null };
          standings?: Array<{ table?: LandingData["standings"] }>;
        })
      : null;

  const standingsTable = Array.isArray(snapshotData?.standings)
    ? snapshotData?.standings?.[0]?.table?.slice(0, 5) ?? []
    : [];

  return {
    stats: {
      supporters,
      clubs,
      activeThreads,
      completedMatches,
    },
    featuredMatches: upcomingMatches.map((match) => ({
      ...match,
      utcDate: match.utcDate.toISOString(),
    })),
    highlightedThreads: recentThreads.map((thread) => ({
      ...thread,
      updatedAt: thread.updatedAt.toISOString(),
      tags: thread.tags.map((entry) => entry.tag.name),
    })),
    standings: standingsTable,
    standingsMeta: {
      competitionName: snapshotData?.competition?.name ?? null,
      fetchedAt: latestStandings?.fetchedAt.toISOString() ?? null,
      season: latestStandings?.season ?? null,
    },
  };
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[1.75rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:color-mix(in_srgb,var(--foreground)_56%,transparent)]">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-[color:var(--foreground)]">
        {value}
      </p>
    </div>
  );
}

export default async function Home() {
  const landing = await getLandingData();

  return (
    <main className="min-h-[calc(100vh-88px)] bg-[image:var(--hero-background)] px-6 py-10 text-[color:var(--foreground)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <section className="overflow-hidden rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-8 shadow-[var(--shadow-hero)] backdrop-blur">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[color:var(--accent-text)]">
                Matchday Hub
              </p>
              <h1 className="mt-4 max-w-3xl text-5xl font-semibold tracking-tight sm:text-6xl">
                Follow the table, feel the rivalry, join the conversation.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-[color:color-mix(in_srgb,var(--foreground)_72%,transparent)]">
                SportsDeck brings fixtures, standings, live fan discussion, AI-powered moderation,
                and supporter activity into one fast matchday home.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/matches"
                  className="rounded-full bg-[color:var(--surface-strong)] px-5 py-3 text-sm font-semibold text-[color:var(--surface-strong-foreground)] transition hover:opacity-90"
                >
                  Explore matches
                </Link>
                <Link
                  href="/forums"
                  className="rounded-full border border-[color:var(--border)] px-5 py-3 text-sm font-semibold text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
                >
                  Enter the forums
                </Link>
                <Link
                  href="/standings"
                  className="rounded-full border border-[color:var(--border)] px-5 py-3 text-sm font-semibold text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
                >
                  Check standings
                </Link>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[1.75rem] border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-6 text-[color:var(--surface-strong-foreground)] shadow-lg">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-current/65">
                  Latest Table Snapshot
                </p>
                <p className="mt-3 text-3xl font-semibold">
                  {landing.standingsMeta.competitionName || "League standings"}
                </p>
                <p className="mt-2 text-sm text-current/75">
                  {landing.standingsMeta.season || "Current season"}
                </p>
                <p className="mt-4 text-sm text-current/75">
                  Updated{" "}
                  {landing.standingsMeta.fetchedAt
                    ? formatDate(landing.standingsMeta.fetchedAt)
                    : "when new standings are seeded"}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <StatCard label="Supporters" value={landing.stats.supporters} />
                <StatCard label="Active Threads" value={landing.stats.activeThreads} />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Clubs in League" value={landing.stats.clubs} />
          <StatCard label="Completed Matches" value={landing.stats.completedMatches} />
          <StatCard label="Forum Threads" value={landing.stats.activeThreads} />
          <StatCard label="Supporters Registered" value={landing.stats.supporters} />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[color:var(--accent-text)]">
                  Upcoming Fixtures
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">Next up on the calendar</h2>
              </div>
              <Link href="/matches" className="text-sm font-semibold text-[color:var(--accent-text)] hover:underline">
                View all
              </Link>
            </div>

            <div className="mt-5 space-y-4">
              {landing.featuredMatches.map((match) => (
                <article
                  key={match.id}
                  className="rounded-[1.75rem] border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-5"
                >
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-[color:var(--surface)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--accent-text)]">
                      {getStatusLabel(match.status)}
                    </span>
                    {match.matchday ? (
                      <span className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-semibold">
                        Matchday {match.matchday}
                      </span>
                    ) : null}
                    {match.stage ? (
                      <span className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-semibold">
                        {match.stage}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
                    <div>
                      <p className="text-xl font-semibold">
                        {match.homeTeam.shortName || match.homeTeam.name}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-semibold tracking-tight">
                        {getScoreText(match.scoreHome)} - {getScoreText(match.scoreAway)}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[color:color-mix(in_srgb,var(--foreground)_55%,transparent)]">
                        {formatDate(match.utcDate)}
                      </p>
                    </div>
                    <div className="text-left md:text-right">
                      <p className="text-xl font-semibold">
                        {match.awayTeam.shortName || match.awayTeam.name}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 text-sm text-[color:color-mix(in_srgb,var(--foreground)_65%,transparent)]">
                    {match.venue || "Venue to be confirmed"}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[color:var(--accent-text)]">
                  Top of the Table
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">Current front-runners</h2>
              </div>
              <Link href="/standings" className="text-sm font-semibold text-[color:var(--accent-text)] hover:underline">
                Full table
              </Link>
            </div>

            <div className="mt-5 space-y-3">
              {landing.standings.length > 0 ? (
                landing.standings.map((row, index) => (
                  <div
                    key={`${row.team?.name ?? "club"}-${index}`}
                    className="flex items-center justify-between rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--surface)] text-sm font-semibold">
                        {row.position ?? index + 1}
                      </div>
                      <div>
                        <p className="font-semibold">
                          {row.team?.shortName || row.team?.tla || row.team?.name || "Club"}
                        </p>
                        {row.team?.name && row.team.name !== (row.team.shortName || row.team.tla || row.team.name) ? (
                          <p className="text-xs text-[color:color-mix(in_srgb,var(--foreground)_60%,transparent)]">
                            {row.team.name}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <p className="text-lg font-semibold">{row.points ?? "-"} pts</p>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-5 text-sm text-[color:color-mix(in_srgb,var(--foreground)_65%,transparent)]">
                  Standings will appear here once snapshot data is available.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[color:var(--accent-text)]">
              Community Highlights
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Where the loudest debates live</h2>

            <div className="mt-5 space-y-4">
              {landing.highlightedThreads.map((thread) => (
                <article
                  key={thread.id}
                  className="rounded-[1.75rem] border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-5"
                >
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-[color:var(--surface)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--accent-text)]">
                      {thread.type}
                    </span>
                    {thread.team ? (
                      <span className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-semibold">
                        {thread.team.shortName || thread.team.name}
                      </span>
                    ) : null}
                  </div>

                  <h3 className="mt-4 text-xl font-semibold tracking-tight">
                    <Link href={`/threads/${thread.id}`} className="hover:text-[color:var(--accent-text)]">
                      {thread.title}
                    </Link>
                  </h3>

                  <div className="mt-4 flex flex-wrap gap-4 text-sm text-[color:color-mix(in_srgb,var(--foreground)_65%,transparent)]">
                    <span>{thread._count.posts} posts</span>
                    <span>{thread._count.polls} polls</span>
                    <span>Updated {formatDate(thread.updatedAt)}</span>
                  </div>

                  {thread.tags.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {thread.tags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs text-[color:color-mix(in_srgb,var(--foreground)_72%,transparent)]"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-6 text-[color:var(--surface-strong-foreground)] shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-current/65">
                Built for Matchday
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-[1.5rem] border border-white/12 bg-white/6 p-4">
                  <p className="text-lg font-semibold">Dedicated match threads</p>
                  <p className="mt-2 text-sm leading-6 text-current/80">
                    Auto-created discussions open before kickoff and stay alive after the final whistle.
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-white/12 bg-white/6 p-4">
                  <p className="text-lg font-semibold">AI-powered moderation</p>
                  <p className="mt-2 text-sm leading-6 text-current/80">
                    Report handling, toxicity detection, and appeal workflows help keep debates usable.
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-white/12 bg-white/6 p-4">
                  <p className="text-lg font-semibold">Supporter profiles</p>
                  <p className="mt-2 text-sm leading-6 text-current/80">
                    Track favorite teams, follower relationships, and a rolling activity footprint.
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-white/12 bg-white/6 p-4">
                  <p className="text-lg font-semibold">Personal feed</p>
                  <p className="mt-2 text-sm leading-6 text-current/80">
                    Grouped activity keeps replies, followed users, and team updates from becoming noise.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[color:var(--accent-text)]">
                Quick Start
              </p>
              <div className="mt-5 grid gap-3">
                <Link
                  href="/register"
                  className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-5 py-4 text-sm font-semibold transition hover:border-[color:var(--accent-text)]"
                >
                  Create your supporter account
                </Link>
                <Link
                  href="/profile?section=feed"
                  className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-5 py-4 text-sm font-semibold transition hover:border-[color:var(--accent-text)]"
                >
                  Open your dashboard feed
                </Link>
                <Link
                  href="/profile"
                  className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-5 py-4 text-sm font-semibold transition hover:border-[color:var(--accent-text)]"
                >
                  Pick your favorite team
                </Link>
                <Link
                  href="/digest"
                  className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-5 py-4 text-sm font-semibold transition hover:border-[color:var(--accent-text)]"
                >
                  Read the daily digest
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
