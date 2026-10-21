"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/app/providers";

type FeedActor = {
  avatarUrl?: string | null;
  id: number;
  username: string;
};

type FeedCategory = "all" | "conversations" | "following" | "team";

type FeedItem = {
  actors: FeedActor[];
  count: number;
  groupKey: string;
  id: number;
  isRead: boolean;
  lastReadAt: string | null;
  latestAt: string;
  matchId: number | null;
  postId: number | null;
  replyId: number | null;
  summary: string;
  teamId: number | null;
  threadId: number | null;
  type:
    | "COMMENT_ON_MY_POST"
    | "COMMENT_ON_MY_THREAD"
    | "FAVORITE_TEAM_MATCH_UPDATE"
    | "FAVORITE_TEAM_NEW_THREAD"
    | "FOLLOWED_USER_POST"
    | "FOLLOWED_USER_REPLY"
    | "FOLLOWED_USER_THREAD";
};

type FeedResponse = {
  items: FeedItem[];
  nextCursor: number | null;
  pagination: {
    limit: number;
    rawEventCount: number;
  };
};

type PersonalFeedSectionProps = {
  refreshKey?: number | string | null;
};

const CATEGORY_LABELS: Record<FeedCategory, string> = {
  all: "All updates",
  conversations: "My conversations",
  following: "Following",
  team: "Favorite team",
};

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

function typeLabel(type: FeedItem["type"]) {
  switch (type) {
    case "COMMENT_ON_MY_POST":
      return "Comment on My Post";
    case "COMMENT_ON_MY_THREAD":
      return "Comment in My Thread";
    case "FAVORITE_TEAM_MATCH_UPDATE":
      return "Favorite Team Score";
    case "FAVORITE_TEAM_NEW_THREAD":
      return "Favorite Team Forum";
    case "FOLLOWED_USER_POST":
      return "Following Activity";
    case "FOLLOWED_USER_REPLY":
      return "Following Activity";
    case "FOLLOWED_USER_THREAD":
      return "Following Activity";
    default:
      return "Feed Item";
  }
}

function feedCategory(item: FeedItem): FeedCategory {
  if (item.type === "COMMENT_ON_MY_POST" || item.type === "COMMENT_ON_MY_THREAD") {
    return "conversations";
  }

  if (
    item.type === "FOLLOWED_USER_POST" ||
    item.type === "FOLLOWED_USER_REPLY" ||
    item.type === "FOLLOWED_USER_THREAD"
  ) {
    return "following";
  }

  return "team";
}

function EmptyAvatar({ label }: { label: string }) {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-muted)] text-xs font-semibold uppercase text-[color:var(--foreground)]">
      {label.slice(0, 2)}
    </div>
  );
}

function ActorStack({ actors }: { actors: FeedActor[] }) {
  if (actors.length === 0) {
    return (
      <div className="flex items-center gap-3">
        <EmptyAvatar label="?" />
        <p className="text-sm text-[color:color-mix(in_srgb,var(--foreground)_65%,transparent)]">
          System activity
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex -space-x-3">
        {actors.slice(0, 3).map((actor) =>
          actor.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={actor.id}
              src={actor.avatarUrl}
              alt={`${actor.username} avatar`}
              className="h-10 w-10 rounded-full border-2 border-[color:var(--surface)] bg-white object-cover"
            />
          ) : (
            <div
              key={actor.id}
              className="rounded-full border-2 border-[color:var(--surface)]"
            >
              <EmptyAvatar label={actor.username} />
            </div>
          )
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[color:var(--foreground)]">
          {actors.map((actor) => actor.username).join(", ")}
        </p>
        <p className="text-xs text-[color:color-mix(in_srgb,var(--foreground)_60%,transparent)]">
          People involved in this update
        </p>
      </div>
    </div>
  );
}

export function PersonalFeedSection({ refreshKey }: PersonalFeedSectionProps) {
  const { accessToken, isAuthenticated, isLoading } = useAuth();
  const searchParams = useSearchParams();
  const sectionRef = useRef<HTMLElement | null>(null);

  const [items, setItems] = useState<FeedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<FeedCategory>("all");

  async function loadFeed(cursor?: number | null) {
    if (!accessToken) {
      return;
    }

    const params = new URLSearchParams({ limit: "12" });
    if (cursor) {
      params.set("cursor", String(cursor));
    }

    const data = await parseJson<FeedResponse>(
      await fetch(`/api/feed?${params.toString()}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    );

    setItems((current) => (cursor ? [...current, ...data.items] : data.items));
    setNextCursor(data.nextCursor);
  }

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !accessToken) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ limit: "12" });
        const data = await parseJson<FeedResponse>(
          await fetch(`/api/feed?${params.toString()}`, {
            cache: "no-store",
            headers: { Authorization: `Bearer ${accessToken}` },
          })
        );

        if (!cancelled) {
          setItems(data.items);
          setNextCursor(data.nextCursor);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load feed");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [accessToken, isAuthenticated, isLoading, refreshKey]);

  useEffect(() => {
    if (searchParams.get("section") === "feed") {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [searchParams]);

  const categoryCounts = useMemo(() => {
    const counts: Record<FeedCategory, number> = {
      all: items.length,
      conversations: 0,
      following: 0,
      team: 0,
    };

    for (const item of items) {
      counts[feedCategory(item)] += 1;
    }

    return counts;
  }, [items]);

  const visibleItems = useMemo(
    () => items.filter((item) => activeCategory === "all" || feedCategory(item) === activeCategory),
    [activeCategory, items]
  );

  async function markItemAsRead(item: FeedItem) {
    if (!accessToken || item.isRead) {
      return;
    }

    await parseJson(
      await fetch("/api/feed/read", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ groupKey: item.groupKey }),
      })
    );

    setItems((current) =>
      current.map((entry) =>
        entry.groupKey === item.groupKey
          ? {
              ...entry,
              isRead: true,
              lastReadAt: new Date().toISOString(),
            }
          : entry
      )
    );
  }

  async function handleLoadMore() {
    if (!nextCursor) {
      return;
    }

    setLoadingMore(true);
    setError(null);

    try {
      await loadFeed(nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load more feed items");
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleOpenThread(item: FeedItem) {
    if (!item.threadId) {
      return;
    }

    setBusyKey(item.groupKey);

    try {
      await markItemAsRead(item);
    } catch {
      // Keep navigation flowing even if read-state sync fails.
    } finally {
      setBusyKey(null);
      window.location.href = `/threads/${item.threadId}`;
    }
  }

  async function handleMarkRead(item: FeedItem) {
    if (!accessToken || item.isRead) {
      return;
    }

    setBusyKey(item.groupKey);

    try {
      await markItemAsRead(item);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to mark this update as read");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <section
      id="feed"
      ref={sectionRef}
      className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[color:var(--accent-text)]">
            Personal Feed
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[color:var(--foreground)]">
            Recent activity, grouped before it gets noisy.
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[color:color-mix(in_srgb,var(--foreground)_70%,transparent)]">
            Replies to your posts, activity from people you follow, and favorite-team
            updates all land here in one grouped stream.
          </p>
        </div>

        <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-5 py-4 text-sm">
          <p className="uppercase tracking-[0.25em] text-[color:color-mix(in_srgb,var(--foreground)_55%,transparent)]">
            Feed State
          </p>
          <p className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">
            {isAuthenticated ? `${items.length} grouped updates` : "Sign in required"}
          </p>
        </div>
      </div>

      {!isAuthenticated ? (
        <div className="mt-6 rounded-[1.75rem] border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-6 text-[color:var(--foreground)]">
          Sign in to see your personalized activity feed.
        </div>
      ) : loading ? (
        <div className="mt-6 rounded-[1.75rem] border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-6 text-[color:var(--foreground)]">
          Loading feed...
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            {(
              Object.keys(CATEGORY_LABELS) as FeedCategory[]
            ).map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  activeCategory === category
                    ? "bg-[color:var(--surface-strong)] text-[color:var(--surface-strong-foreground)]"
                    : "border border-[color:var(--border)] bg-[color:var(--surface-muted)] text-[color:var(--foreground)] hover:border-[color:var(--accent-text)]"
                }`}
              >
                {CATEGORY_LABELS[category]} ({categoryCounts[category]})
              </button>
            ))}
          </div>

          {error ? (
            <div className="mt-6 rounded-[1.75rem] border border-red-300/60 bg-red-100/70 p-6 text-red-800 shadow-sm">
              {error}
            </div>
          ) : null}

          {visibleItems.length === 0 ? (
            <div className="mt-6 rounded-[1.75rem] border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-6 text-[color:color-mix(in_srgb,var(--foreground)_68%,transparent)]">
              {items.length === 0
                ? "No feed items yet. Follow users or pick a favorite team to get started."
                : `No items in ${CATEGORY_LABELS[activeCategory].toLowerCase()} right now.`}
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {visibleItems.map((item) => (
                <article
                  key={`${item.groupKey}-${item.id}`}
                  className={`rounded-[1.75rem] border p-6 shadow-sm transition ${
                    item.isRead
                      ? "border-[color:color-mix(in_srgb,var(--border)_70%,transparent)] bg-[color:color-mix(in_srgb,var(--surface)_88%,transparent)] opacity-80"
                      : "border-[color:var(--border)] bg-[color:var(--surface-muted)]"
                  }`}
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-[color:var(--surface)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--accent-text)]">
                          {typeLabel(item.type)}
                        </span>
                        <span className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-semibold text-[color:color-mix(in_srgb,var(--foreground)_70%,transparent)]">
                          {item.count} event{item.count === 1 ? "" : "s"}
                        </span>
                        {item.isRead ? (
                          <span className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-semibold text-[color:color-mix(in_srgb,var(--foreground)_58%,transparent)]">
                            Read
                          </span>
                        ) : (
                          <span className="rounded-full bg-[rgba(16,185,129,0.14)] px-3 py-1 text-xs font-semibold text-emerald-700">
                            Unread
                          </span>
                        )}
                      </div>

                      <h3 className="mt-4 text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">
                        {item.summary}
                      </h3>

                      <p className="mt-2 text-sm text-[color:color-mix(in_srgb,var(--foreground)_70%,transparent)]">
                        {formatDate(item.latestAt)}
                      </p>

                      <div className="mt-5">
                        <ActorStack actors={item.actors} />
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 lg:min-w-52">
                      {item.threadId ? (
                        <button
                          type="button"
                          onClick={() => void handleOpenThread(item)}
                          disabled={busyKey === item.groupKey}
                          className="inline-flex justify-center rounded-full bg-[color:var(--surface-strong)] px-4 py-2 text-sm font-semibold text-[color:var(--surface-strong-foreground)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {busyKey === item.groupKey ? "Opening..." : "Open thread"}
                        </button>
                      ) : null}

                      {item.matchId ? (
                        <Link
                          href="/matches"
                          className="inline-flex justify-center rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)] transition hover:bg-[color:var(--surface)]"
                        >
                          View match center
                        </Link>
                      ) : null}

                      {!item.matchId && item.teamId ? (
                        <Link
                          href="/forums"
                          className="inline-flex justify-center rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)] transition hover:bg-[color:var(--surface)]"
                        >
                          Browse team forum
                        </Link>
                      ) : null}

                      {!item.isRead ? (
                        <button
                          type="button"
                          onClick={() => void handleMarkRead(item)}
                          disabled={busyKey === item.groupKey}
                          className="inline-flex justify-center rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)] transition hover:bg-[color:var(--surface)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {busyKey === item.groupKey ? "Updating..." : "Mark read"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}

              {nextCursor ? (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-5 py-3 text-sm font-semibold text-[color:var(--foreground)] shadow-sm transition hover:bg-[color:var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loadingMore ? "Loading more..." : "Load more"}
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </>
      )}
    </section>
  );
}
