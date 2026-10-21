"use client";

import Link from "next/link";

type Team = {
  crestUrl: string | null;
  name: string;
  score: number | null;
  shortName: string | null;
};

export type MatchCardMatch = {
  awayTeam: Team;
  externalId: number;
  homeTeam: Team;
  id: number;
  matchday: number | null;
  stage: string | null;
  status: string;
  threadId: number | null;
  utcDate: string;
  venue: string | null;
};

function formatKickoff(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getStatusLabel(match: MatchCardMatch) {
  if (match.status === "FINISHED") {
    return "Full time";
  }
  if (match.status === "IN_PLAY") {
    return "Live";
  }
  if (match.status === "PAUSED") {
    return "Halftime";
  }
  if (match.status === "TIMED") {
    return "Scheduled";
  }
  return match.status.replaceAll("_", " ");
}

function getScoreText(score: number | null) {
  return score === null ? "-" : String(score);
}

function TeamBadge({ team, align = "left" }: { align?: "left" | "right"; team: Team }) {
  return (
    <div
      className={`flex items-center gap-4 ${align === "right" ? "justify-start md:justify-end" : ""}`}
    >
      {align === "right" ? (
        <div className="text-right">
          <p className="text-sm text-[color:color-mix(in_srgb,var(--foreground)_65%,transparent)]">
            Away
          </p>
          <p className="text-xl font-semibold tracking-tight">{team.shortName || team.name}</p>
        </div>
      ) : null}

      {team.crestUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={team.crestUrl}
          alt={`${team.name} crest`}
          className="h-12 w-12 rounded-full border border-[color:var(--border)] bg-white object-contain p-1"
        />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-muted)] text-xs font-semibold uppercase">
          {team.shortName?.slice(0, 3) ?? team.name.slice(0, 3)}
        </div>
      )}

      {align === "left" ? (
        <div>
          <p className="text-sm text-[color:color-mix(in_srgb,var(--foreground)_65%,transparent)]">
            Home
          </p>
          <p className="text-xl font-semibold tracking-tight">{team.shortName || team.name}</p>
        </div>
      ) : null}
    </div>
  );
}

export function MatchCard({ match }: { match: MatchCardMatch }) {
  return (
    <article className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm transition hover:shadow-md">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex-1">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-[color:var(--surface-muted)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--accent-text)]">
              {getStatusLabel(match)}
            </span>
            {match.matchday !== null ? (
              <span className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-semibold text-[color:color-mix(in_srgb,var(--foreground)_72%,transparent)]">
                Matchday {match.matchday}
              </span>
            ) : null}
            {match.stage ? (
              <span className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-semibold text-[color:color-mix(in_srgb,var(--foreground)_72%,transparent)]">
                {match.stage}
              </span>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <TeamBadge team={match.homeTeam} />

            <div className="text-center">
              <div className="text-3xl font-semibold tracking-tight">
                {getScoreText(match.homeTeam.score)}{" "}
                <span className="text-[color:color-mix(in_srgb,var(--foreground)_45%,transparent)]">
                  -
                </span>{" "}
                {getScoreText(match.awayTeam.score)}
              </div>
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-[color:color-mix(in_srgb,var(--foreground)_55%,transparent)]">
                {formatKickoff(match.utcDate)}
              </p>
            </div>

            <TeamBadge team={match.awayTeam} align="right" />
          </div>
        </div>

        <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-5 py-4 text-sm lg:min-w-56">
          <p className="font-semibold text-[color:var(--foreground)]">Venue</p>
          <p className="mt-1 text-[color:color-mix(in_srgb,var(--foreground)_72%,transparent)]">
            {match.venue || "Venue TBA"}
          </p>
          <p className="mt-4 font-semibold text-[color:var(--foreground)]">Fixture ID</p>
          <p className="mt-1 text-[color:color-mix(in_srgb,var(--foreground)_72%,transparent)]">
            #{match.externalId}
          </p>
          <div className="mt-4">
            {match.threadId ? (
              <Link
                href={`/threads/${match.threadId}`}
                className="inline-flex rounded-full bg-[color:var(--surface-strong)] px-4 py-2 text-sm font-semibold text-[color:var(--surface-strong-foreground)] transition hover:opacity-90"
              >
                Open match thread
              </Link>
            ) : (
              <span className="inline-flex rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium text-[color:color-mix(in_srgb,var(--foreground)_68%,transparent)]">
                Thread not available yet
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
