"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/app/providers";

type UserPageData = {
  activity: Array<{ date: string; posts: number; replies: number; threads: number }>;
  recentPagination: {
    content: ContentTab;
    limit: number;
    offset: number;
    total: number;
  };
  recent: {
    posts: Array<{
      body: string;
      createdAt: string;
      id: number;
      thread: { id: number; title: string; type: string };
      _count: { replies: number };
    }>;
    replies: Array<{
      body: string;
      createdAt: string;
      id: number;
      post: { id: number; thread: { id: number; title: string; type: string } };
    }>;
    threads: Array<{
      _count: { polls: number; posts: number };
      createdAt: string;
      id: number;
      match: {
        awayTeam: { name: string; shortName: string | null };
        homeTeam: { name: string; shortName: string | null };
        id: number;
        utcDate: string;
      } | null;
      team: { id: number; name: string; shortName: string | null } | null;
      title: string;
      type: string;
      updatedAt: string;
    }>;
  };
  user: {
    avatarUrl: string | null;
    counts: {
      followers: number;
      following: number;
      posts: number;
      replies: number;
      threads: number;
    };
    createdAt: string;
    favoriteTeam: {
      crestUrl: string | null;
      id: number;
      name: string;
      shortName: string | null;
    } | null;
    favoriteTeamId: number | null;
    id: number;
    username: string;
  };
};

type FollowingResponse = {
  items: Array<{
    followedAt: string;
    user: {
      avatarUrl: string | null;
      favoriteTeamId: number | null;
      id: number;
      username: string;
    };
  }>;
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
};

type ContentTab = "posts" | "replies" | "threads";
const PAGE_SIZE = 10;

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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getActivityTotal(day: UserPageData["activity"][number]) {
  return day.threads + day.posts + day.replies;
}

function trimPreview(value: string, limit = 180) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= limit) {
    return compact;
  }
  return `${compact.slice(0, limit - 1)}...`;
}

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken, user: viewer } = useAuth();

  const [data, setData] = useState<UserPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ContentTab>("threads");
  const [contentPage, setContentPage] = useState(1);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const requests: Promise<Response>[] = [
          fetch(
            `/api/users/${id}?content=${activeTab}&limit=${PAGE_SIZE}&offset=${(contentPage - 1) * PAGE_SIZE}`,
            { cache: "no-store" }
          ),
        ];

        if (accessToken) {
          requests.push(
            fetch("/api/users/me/following", {
              cache: "no-store",
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            })
          );
        }

        const [profileResponse, followingResponse] = await Promise.all(requests);
        const nextData = await parseJson<UserPageData>(profileResponse);

        if (!cancelled) {
          setData(nextData);
        }

        if (followingResponse && !cancelled) {
          const following = await parseJson<FollowingResponse>(followingResponse);
          setIsFollowing(following.items.some((entry) => entry.user.id === nextData.user.id));
        } else if (!followingResponse && !cancelled) {
          setIsFollowing(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load user");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, activeTab, contentPage, id]);

  useEffect(() => {
    setContentPage(1);
  }, [activeTab, id]);

  const maxActivity = useMemo(() => {
    if (!data) {
      return 1;
    }
    return Math.max(1, ...data.activity.map(getActivityTotal));
  }, [data]);

  async function handleFollowToggle() {
    if (!accessToken || !data) {
      setFollowError("Sign in to follow this user.");
      return;
    }

    setFollowBusy(true);
    setFollowError(null);

    try {
      const response = await fetch(`/api/users/${data.user.id}/follow`, {
        method: isFollowing ? "DELETE" : "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      await parseJson<Record<string, unknown>>(response);

      setIsFollowing((current) => !current);
      setData((current) =>
        current
          ? {
              ...current,
              user: {
                ...current.user,
                counts: {
                  ...current.user.counts,
                  followers: current.user.counts.followers + (isFollowing ? -1 : 1),
                },
              },
            }
          : current
      );
    } catch (err) {
      setFollowError(err instanceof Error ? err.message : "Unable to update follow state");
    } finally {
      setFollowBusy(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-88px)] bg-[image:var(--hero-background)] px-6 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        {loading ? (
          <div className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-8 shadow-sm">
            Loading user profile...
          </div>
        ) : error ? (
          <div className="rounded-[2rem] border border-red-300/60 bg-red-100/70 p-8 text-red-800 shadow-sm">
            {error}
          </div>
        ) : !data ? null : (
          <>
            <section className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-8 shadow-[var(--shadow-hero)] backdrop-blur">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  {data.user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={data.user.avatarUrl}
                      alt={`${data.user.username} avatar`}
                      className="h-24 w-24 rounded-full border border-[color:var(--border)] bg-white object-cover"
                    />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-muted)] text-3xl font-semibold uppercase text-[color:var(--foreground)]">
                      {data.user.username.slice(0, 2)}
                    </div>
                  )}

                  <div className="max-w-3xl">
                    <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[color:var(--accent-text)]">
                      Supporter Profile
                    </p>
                    <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[color:var(--foreground)]">
                      {data.user.username}
                    </h1>
                    <p className="mt-3 text-base text-[color:color-mix(in_srgb,var(--foreground)_72%,transparent)]">
                      Associated team:{" "}
                      {data.user.favoriteTeam?.shortName ||
                        data.user.favoriteTeam?.name ||
                        "Not set"}
                    </p>
                    <p className="mt-2 text-sm text-[color:color-mix(in_srgb,var(--foreground)_60%,transparent)]">
                      Joined {formatDate(data.user.createdAt)}
                    </p>
                  </div>
                </div>

                {viewer && viewer.id !== data.user.id ? (
                  <div className="flex flex-col items-start gap-3 lg:items-end">
                    <button
                      type="button"
                      onClick={handleFollowToggle}
                      disabled={followBusy}
                      className={`rounded-full px-5 py-3 text-sm font-semibold transition ${
                        isFollowing
                          ? "border border-[color:var(--border)] bg-[color:var(--surface-muted)] text-[color:var(--foreground)] hover:bg-[color:var(--surface)]"
                          : "bg-[color:var(--surface-strong)] text-[color:var(--surface-strong-foreground)] hover:opacity-90"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      {followBusy
                        ? "Updating..."
                        : isFollowing
                          ? "Unfollow"
                          : "Follow"}
                    </button>
                    {followError ? (
                      <p className="text-sm text-red-700">{followError}</p>
                    ) : null}
                  </div>
                ) : viewer && viewer.id === data.user.id ? (
                  <div className="flex flex-col items-start gap-3 lg:items-end">
                    <Link
                      href="/profile"
                      className="rounded-full bg-[color:var(--surface-strong)] px-5 py-3 text-sm font-semibold text-[color:var(--surface-strong-foreground)] transition hover:opacity-90"
                    >
                      Open dashboard
                    </Link>
                  </div>
                ) : null}
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <Link
                  href={`/users/${data.user.id}/followers`}
                  className="rounded-2xl bg-[color:var(--surface-muted)] p-4 transition hover:bg-[color:var(--surface)]"
                >
                  <p className="text-xs uppercase tracking-[0.18em]">Followers</p>
                  <p className="mt-2 text-2xl font-semibold">{data.user.counts.followers}</p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--accent-text)]">
                    View list
                  </p>
                </Link>
                <Link
                  href={`/users/${data.user.id}/following`}
                  className="rounded-2xl bg-[color:var(--surface-muted)] p-4 transition hover:bg-[color:var(--surface)]"
                >
                  <p className="text-xs uppercase tracking-[0.18em]">Following</p>
                  <p className="mt-2 text-2xl font-semibold">{data.user.counts.following}</p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--accent-text)]">
                    View list
                  </p>
                </Link>
                <div className="rounded-2xl bg-[color:var(--surface-muted)] p-4">
                  <p className="text-xs uppercase tracking-[0.18em]">Threads</p>
                  <p className="mt-2 text-2xl font-semibold">{data.user.counts.threads}</p>
                </div>
                <div className="rounded-2xl bg-[color:var(--surface-muted)] p-4">
                  <p className="text-xs uppercase tracking-[0.18em]">Posts</p>
                  <p className="mt-2 text-2xl font-semibold">{data.user.counts.posts}</p>
                </div>
                <div className="rounded-2xl bg-[color:var(--surface-muted)] p-4">
                  <p className="text-xs uppercase tracking-[0.18em]">Replies</p>
                  <p className="mt-2 text-2xl font-semibold">{data.user.counts.replies}</p>
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-[color:var(--foreground)]">
                    30-day activity
                  </h2>
                  <p className="mt-2 text-sm text-[color:color-mix(in_srgb,var(--foreground)_68%,transparent)]">
                    Threads, posts, and replies over the last month.
                  </p>
                </div>
                <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3 text-sm">
                  Peak day: {maxActivity} actions
                </div>
              </div>

              <div className="mt-6 grid grid-cols-10 gap-2 md:grid-cols-15 lg:grid-cols-30">
                {data.activity.map((day) => {
                  const total = getActivityTotal(day);
                  const height = `${Math.max(16, Math.round((total / maxActivity) * 120))}px`;

                  return (
                    <div key={day.date} className="flex flex-col items-center gap-2">
                      <div
                        className="flex w-full items-end justify-center rounded-2xl bg-[color:var(--surface-muted)] px-1"
                        style={{ height: "128px" }}
                        title={`${day.date}: ${day.threads} threads, ${day.posts} posts, ${day.replies} replies`}
                      >
                        <div
                          className="w-full rounded-xl bg-[color:var(--surface-strong)]"
                          style={{ height }}
                        />
                      </div>
                      <span className="text-[10px] uppercase tracking-[0.12em] text-[color:color-mix(in_srgb,var(--foreground)_55%,transparent)]">
                        {day.date.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-[color:var(--foreground)]">
                    Recent contributions
                  </h2>
                  <p className="mt-2 text-sm text-[color:color-mix(in_srgb,var(--foreground)_68%,transparent)]">
                    Jump into this supporter&apos;s latest threads, posts, and replies.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(["threads", "posts", "replies"] as ContentTab[]).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        activeTab === tab
                          ? "bg-[color:var(--surface-strong)] text-[color:var(--surface-strong-foreground)]"
                          : "border border-[color:var(--border)] bg-[color:var(--surface-muted)] text-[color:var(--foreground)] hover:border-[color:var(--accent-text)]"
                      }`}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div className="flex flex-col gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-[color:color-mix(in_srgb,var(--foreground)_68%,transparent)]">
                    Showing{" "}
                    {data.recentPagination.total === 0
                      ? 0
                      : data.recentPagination.offset + 1}
                    -
                    {Math.min(
                      data.recentPagination.offset + data.recent[activeTab].length,
                      data.recentPagination.total
                    )}{" "}
                    of {data.recentPagination.total} {activeTab}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setContentPage((current) => Math.max(1, current - 1))}
                      disabled={contentPage === 1}
                      className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-semibold transition hover:bg-[color:var(--surface)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Previous
                    </button>
                    <span className="rounded-full bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold">
                      Page {contentPage}
                    </span>
                    <button
                      type="button"
                      onClick={() => setContentPage((current) => current + 1)}
                      disabled={data.recentPagination.offset + data.recentPagination.limit >= data.recentPagination.total}
                      className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-semibold transition hover:bg-[color:var(--surface)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Next
                    </button>
                  </div>
                </div>
                {activeTab === "threads" && (
                  <>
                    {data.recent.threads.length === 0 ? (
                      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-5 text-sm text-[color:color-mix(in_srgb,var(--foreground)_65%,transparent)]">
                        No recent threads yet.
                      </div>
                    ) : (
                      data.recent.threads.map((thread) => (
                        <article
                          key={thread.id}
                          className="rounded-[1.75rem] border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-5"
                        >
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-[rgba(14,165,233,0.12)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--accent-text)]">
                              {thread.type}
                            </span>
                            {thread.team ? (
                              <span className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-semibold">
                                {thread.team.shortName || thread.team.name}
                              </span>
                            ) : null}
                          </div>
                          <h3 className="mt-4 text-2xl font-semibold tracking-tight">
                            <Link href={`/threads/${thread.id}`} className="hover:text-[color:var(--accent-text)]">
                              {thread.title}
                            </Link>
                          </h3>
                          {thread.match ? (
                            <p className="mt-2 text-sm text-[color:color-mix(in_srgb,var(--foreground)_65%,transparent)]">
                              {thread.match.homeTeam.shortName || thread.match.homeTeam.name} vs{" "}
                              {thread.match.awayTeam.shortName || thread.match.awayTeam.name}
                            </p>
                          ) : null}
                          <div className="mt-4 flex flex-wrap gap-4 text-sm text-[color:color-mix(in_srgb,var(--foreground)_65%,transparent)]">
                            <span>{thread._count.posts} posts</span>
                            <span>{thread._count.polls} polls</span>
                            <span>Updated {formatDate(thread.updatedAt)}</span>
                          </div>
                        </article>
                      ))
                    )}
                  </>
                )}

                {activeTab === "posts" && (
                  <>
                    {data.recent.posts.length === 0 ? (
                      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-5 text-sm text-[color:color-mix(in_srgb,var(--foreground)_65%,transparent)]">
                        No recent posts yet.
                      </div>
                    ) : (
                      data.recent.posts.map((post) => (
                        <article
                          key={post.id}
                          className="rounded-[1.75rem] border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-5"
                        >
                          <div className="flex flex-wrap items-center gap-3 text-sm text-[color:color-mix(in_srgb,var(--foreground)_65%,transparent)]">
                            <span className="rounded-full border border-[color:var(--border)] px-3 py-1 font-semibold uppercase tracking-[0.18em]">
                              {post.thread.type}
                            </span>
                            <span>{formatDate(post.createdAt)}</span>
                            <span>{post._count.replies} replies</span>
                          </div>
                          <h3 className="mt-4 text-xl font-semibold">
                            <Link href={`/threads/${post.thread.id}`} className="hover:text-[color:var(--accent-text)]">
                              {post.thread.title}
                            </Link>
                          </h3>
                          <p className="mt-3 leading-7 text-[color:color-mix(in_srgb,var(--foreground)_82%,transparent)]">
                            {trimPreview(post.body)}
                          </p>
                        </article>
                      ))
                    )}
                  </>
                )}

                {activeTab === "replies" && (
                  <>
                    {data.recent.replies.length === 0 ? (
                      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-5 text-sm text-[color:color-mix(in_srgb,var(--foreground)_65%,transparent)]">
                        No recent replies yet.
                      </div>
                    ) : (
                      data.recent.replies.map((reply) => (
                        <article
                          key={reply.id}
                          className="rounded-[1.75rem] border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-5"
                        >
                          <div className="flex flex-wrap items-center gap-3 text-sm text-[color:color-mix(in_srgb,var(--foreground)_65%,transparent)]">
                            <span>{formatDate(reply.createdAt)}</span>
                            <span>
                              In{" "}
                              <Link
                                href={`/threads/${reply.post.thread.id}`}
                                className="font-semibold text-[color:var(--foreground)] hover:text-[color:var(--accent-text)]"
                              >
                                {reply.post.thread.title}
                              </Link>
                            </span>
                          </div>
                          <p className="mt-3 leading-7 text-[color:color-mix(in_srgb,var(--foreground)_82%,transparent)]">
                            {trimPreview(reply.body)}
                          </p>
                        </article>
                      ))
                    )}
                  </>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
