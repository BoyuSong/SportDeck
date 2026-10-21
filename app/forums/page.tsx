"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/providers";

type Team = {
  id: number;
  name: string;
  shortName: string | null;
};

type Thread = {
  _count: {
    polls: number;
    posts: number;
  };
  author: {
    id: number;
    username: string;
  } | null;
  createdAt: string;
  id: number;
  isOpenForPosting: boolean;
  match: {
    awayTeam: { name: string; shortName: string | null };
    homeTeam: { name: string; shortName: string | null };
    id: number;
    status: string;
    utcDate: string;
  } | null;
  status: string;
  tags: string[];
  team: Team | null;
  title: string;
  type: "GENERAL" | "MATCH" | "TEAM";
  updatedAt: string;
};

type ThreadsResponse = {
  pagination: {
    limit: number;
    offset: number;
  };
  threads: Thread[];
  total: number;
};

const PAGE_SIZE = 12;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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

export default function ForumsPage() {
  const { accessToken, isAuthenticated, user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"" | "GENERAL" | "MATCH" | "TEAM">("");
  const [teamId, setTeamId] = useState("");
  const [author, setAuthor] = useState("");
  const [page, setPage] = useState(1);

  const [composerTitle, setComposerTitle] = useState("");
  const [composerBody, setComposerBody] = useState("");
  const [composerType, setComposerType] = useState<"GENERAL" | "TEAM">("GENERAL");
  const [composerTeamId, setComposerTeamId] = useState("");
  const [composerTags, setComposerTags] = useState("");
  const [composerError, setComposerError] = useState<string | null>(null);
  const [composerSubmitting, setComposerSubmitting] = useState(false);

  const searchParams = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (type) params.set("type", type);
    if (teamId) params.set("teamId", teamId);
    if (author.trim()) params.set("author", author.trim());
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String((page - 1) * PAGE_SIZE));
    return params;
  }, [author, page, query, teamId, type]);

  async function loadTeams() {
    const data = await parseJson<{ teams: Team[] }>(await fetch("/api/league/teams"));
    setTeams(
      data.teams.map((team) => ({
        id: team.id,
        name: team.name,
        shortName: team.shortName,
      }))
    );
  }

  async function loadThreads() {
    setLoading(true);
    setError(null);

    try {
      const data = await parseJson<ThreadsResponse>(
        await fetch(`/api/threads?${searchParams.toString()}`, { cache: "no-store" })
      );
      setThreads(data.threads);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load threads");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTeams();
  }, []);

  useEffect(() => {
    void loadThreads();
  }, [searchParams]);

  useEffect(() => {
    setPage(1);
  }, [author, query, teamId, type]);

  async function handleCreateThread(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      setComposerError("You must be signed in to create a thread");
      return;
    }

    setComposerSubmitting(true);
    setComposerError(null);

    try {
      const payload = {
        title: composerTitle.trim(),
        body: composerBody.trim(),
        type: composerType,
        teamId: composerType === "TEAM" ? Number(composerTeamId) : undefined,
        tags: composerTags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      };

      await parseJson(
        await fetch("/api/threads", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        })
      );

      setComposerTitle("");
      setComposerBody("");
      setComposerTags("");
      setComposerTeamId("");
      setComposerType("GENERAL");
      setPage(1);
      await loadThreads();
    } catch (err) {
      setComposerError(err instanceof Error ? err.message : "Unable to create thread");
    } finally {
      setComposerSubmitting(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-88px)] bg-[image:var(--hero-background)] px-6 py-10 text-[color:var(--foreground)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <section className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-8 shadow-[var(--shadow-hero)] backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[color:var(--accent-text)]">
                Forums
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight">Find the best matchday debates.</h1>
              <p className="mt-3 text-base leading-7 text-[color:color-mix(in_srgb,var(--foreground)_72%,transparent)]">
                Browse general discussion, club-specific forums, and auto-generated match threads from one place.
              </p>
            </div>
            <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-5 py-4 text-sm">
              <p className="uppercase tracking-[0.25em] text-[color:color-mix(in_srgb,var(--foreground)_55%,transparent)]">
                Signed In
              </p>
              <p className="mt-2 text-lg font-semibold">
                {user ? user.username : "Guest browsing"}
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-6">
            <div className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Filters</h2>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium">Search title</label>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3 outline-none transition focus:border-[color:var(--accent-text)]"
                    placeholder="Search threads..."
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Thread type</label>
                  <select
                    value={type}
                    onChange={(event) =>
                      setType(event.target.value as "" | "GENERAL" | "MATCH" | "TEAM")
                    }
                    className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3 outline-none transition focus:border-[color:var(--accent-text)]"
                  >
                    <option value="">All types</option>
                    <option value="GENERAL">General</option>
                    <option value="TEAM">Team</option>
                    <option value="MATCH">Match</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Team</label>
                  <select
                    value={teamId}
                    onChange={(event) => setTeamId(event.target.value)}
                    className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3 outline-none transition focus:border-[color:var(--accent-text)]"
                  >
                    <option value="">All teams</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.shortName || team.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Author username</label>
                  <input
                    value={author}
                    onChange={(event) => setAuthor(event.target.value)}
                    className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3 outline-none transition focus:border-[color:var(--accent-text)]"
                    placeholder="Filter by author"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setType("");
                    setTeamId("");
                    setAuthor("");
                    setPage(1);
                  }}
                  className="w-full rounded-2xl border border-[color:var(--border)] px-4 py-3 text-sm font-medium text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
                >
                  Reset filters
                </button>
              </div>
            </div>

            <div className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Create thread</h2>
              {isAuthenticated ? (
                <form onSubmit={handleCreateThread} className="mt-4 space-y-4">
                  <input
                    value={composerTitle}
                    onChange={(event) => setComposerTitle(event.target.value)}
                    className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3 outline-none transition focus:border-[color:var(--accent-text)]"
                    placeholder="Thread title"
                    required
                  />
                  <textarea
                    value={composerBody}
                    onChange={(event) => setComposerBody(event.target.value)}
                    className="min-h-32 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3 outline-none transition focus:border-[color:var(--accent-text)]"
                    placeholder="Start the conversation..."
                    required
                  />
                  <select
                    value={composerType}
                    onChange={(event) => setComposerType(event.target.value as "GENERAL" | "TEAM")}
                    className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3 outline-none transition focus:border-[color:var(--accent-text)]"
                  >
                    <option value="GENERAL">General forum</option>
                    <option value="TEAM">Team forum</option>
                  </select>
                  {composerType === "TEAM" ? (
                    <select
                      value={composerTeamId}
                      onChange={(event) => setComposerTeamId(event.target.value)}
                      className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3 outline-none transition focus:border-[color:var(--accent-text)]"
                      required
                    >
                      <option value="">Choose a team</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.shortName || team.name}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <input
                    value={composerTags}
                    onChange={(event) => setComposerTags(event.target.value)}
                    className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3 outline-none transition focus:border-[color:var(--accent-text)]"
                    placeholder="Tags, comma separated"
                  />
                  {composerError ? (
                    <div className="rounded-2xl border border-red-300/60 bg-red-100/70 px-4 py-3 text-sm text-red-800">
                      {composerError}
                    </div>
                  ) : null}
                  <button
                    type="submit"
                    disabled={composerSubmitting}
                    className="w-full rounded-2xl bg-[color:var(--surface-strong)] px-4 py-3 text-sm font-semibold text-[color:var(--surface-strong-foreground)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {composerSubmitting ? "Posting..." : "Create thread"}
                  </button>
                </form>
              ) : (
                <div className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-4 text-sm text-[color:color-mix(in_srgb,var(--foreground)_70%,transparent)]">
                  Sign in to create new threads and join the discussion.
                </div>
              )}
            </div>
          </aside>

          <section className="space-y-4">
            {!loading && !error ? (
              <div className="flex flex-col gap-3 rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-[color:color-mix(in_srgb,var(--foreground)_68%,transparent)]">
                  Showing {threads.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}-
                  {Math.min(page * PAGE_SIZE, total)} of {total} threads
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
                    disabled={page * PAGE_SIZE >= total}
                    className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-semibold transition hover:bg-[color:var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
            {loading ? (
              <div className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-8 shadow-sm">
                Loading threads...
              </div>
            ) : error ? (
              <div className="rounded-[2rem] border border-red-300/60 bg-red-100/70 p-8 text-red-800 shadow-sm">
                {error}
              </div>
            ) : threads.length === 0 ? (
              <div className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-8 shadow-sm">
                No threads match the current filters.
              </div>
            ) : (
              threads.map((thread) => (
                <article
                  key={thread.id}
                  className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-3xl">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-[color:var(--surface-muted)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--accent-text)]">
                          {thread.type}
                        </span>
                        {thread.team ? (
                          <span className="rounded-full bg-[rgba(14,165,233,0.12)] px-3 py-1 text-xs font-semibold text-[color:var(--foreground)]">
                            {thread.team.shortName || thread.team.name}
                          </span>
                        ) : null}
                        {!thread.isOpenForPosting ? (
                          <span className="rounded-full bg-[rgba(244,63,94,0.12)] px-3 py-1 text-xs font-semibold text-[color:var(--foreground)]">
                            Closed
                          </span>
                        ) : null}
                      </div>

                      <h2 className="mt-4 text-2xl font-semibold tracking-tight">
                        <Link href={`/threads/${thread.id}`} className="hover:text-[color:var(--accent-text)]">
                          {thread.title}
                        </Link>
                      </h2>

                      {thread.match ? (
                        <p className="mt-2 text-sm text-[color:color-mix(in_srgb,var(--foreground)_70%,transparent)]">
                          {thread.match.homeTeam.shortName || thread.match.homeTeam.name} vs{" "}
                          {thread.match.awayTeam.shortName || thread.match.awayTeam.name} ·{" "}
                          {formatDate(thread.match.utcDate)}
                        </p>
                      ) : null}

                      {thread.tags.length > 0 ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {thread.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs text-[color:color-mix(in_srgb,var(--foreground)_72%,transparent)]"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="grid gap-2 text-sm text-[color:color-mix(in_srgb,var(--foreground)_70%,transparent)] lg:text-right">
                      <p>
                        By{" "}
                        {thread.author ? (
                          <Link
                            href={`/users/${thread.author.id}`}
                            className="font-semibold text-[color:var(--foreground)] hover:text-[color:var(--accent-text)]"
                          >
                            {thread.author.username}
                          </Link>
                        ) : (
                          "System"
                        )}
                      </p>
                      <p>{thread._count.posts} posts</p>
                      <p>{thread._count.polls} polls</p>
                      <p>Updated {formatDate(thread.updatedAt)}</p>
                    </div>
                  </div>
                </article>
              ))
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
