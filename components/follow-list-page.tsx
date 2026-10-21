"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers";

type FollowListEntry = {
  followedAt: string;
  user: {
    avatarUrl: string | null;
    favoriteTeamId: number | null;
    id: number;
    username: string;
  };
};

type FollowListResponse = {
  items: FollowListEntry[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
};

type FollowListPageProps = {
  backHref?: string;
  description: string;
  emptyMessage: string;
  endpoint?: string;
  mode: "followers" | "following";
  readOnly?: boolean;
  requireAuth?: boolean;
  secondaryHref?: string;
  secondaryLabel?: string;
  title: string;
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function FollowListPage({
  backHref = "/profile",
  description,
  emptyMessage,
  endpoint,
  mode,
  readOnly = false,
  requireAuth = true,
  secondaryHref,
  secondaryLabel,
  title,
}: FollowListPageProps) {
  const router = useRouter();
  const { accessToken, isAuthenticated, isLoading } = useAuth();

  const [entries, setEntries] = useState<FollowListEntry[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);

  const resolvedEndpoint =
    endpoint ??
    (mode === "followers" ? "/api/users/me/followers" : "/api/users/me/following");

  useEffect(() => {
    if (requireAuth && !isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, requireAuth, router]);

  useEffect(() => {
    if (requireAuth && !accessToken) {
      return;
    }

    let cancelled = false;

    async function loadEntries() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${resolvedEndpoint}?limit=${PAGE_SIZE}&offset=${(page - 1) * PAGE_SIZE}`,
          {
            cache: "no-store",
            headers: accessToken
              ? {
                  Authorization: `Bearer ${accessToken}`,
                }
              : undefined,
          }
        );

        const data = await parseJson<FollowListResponse>(response);

        if (!cancelled) {
          setEntries(data.items);
          setTotal(data.pagination.total);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : `Unable to load ${mode}.`
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadEntries();

    return () => {
      cancelled = true;
    };
  }, [accessToken, mode, page, requireAuth, resolvedEndpoint]);

  const statsLabel = useMemo(() => `${total} ${mode}`, [mode, total]);

  async function handleAction(userId: number) {
    if (!accessToken || readOnly) {
      setError("Sign in again to update your network.");
      return;
    }

    setBusyUserId(userId);
    setError(null);

    try {
      const response = await fetch(
        mode === "followers"
          ? `/api/users/me/followers/${userId}`
          : `/api/users/${userId}/follow`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      await parseJson<Record<string, unknown>>(response);
      setEntries((current) => current.filter((entry) => entry.user.id !== userId));
      setTotal((current) => Math.max(0, current - 1));
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "Unable to update this relationship."
      );
    } finally {
      setBusyUserId(null);
    }
  }

  if (isLoading || loading) {
    return (
      <main className="min-h-[calc(100vh-88px)] bg-[image:var(--hero-background)] px-6 py-10">
        <div className="mx-auto w-full max-w-5xl rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-8 shadow-sm">
          Loading {mode}...
        </div>
      </main>
    );
  }

  if (requireAuth && !isAuthenticated) {
    return null;
  }

  return (
    <main className="min-h-[calc(100vh-88px)] bg-[image:var(--hero-background)] px-6 py-10 text-[color:var(--foreground)]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <section className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-8 shadow-[var(--shadow-hero)] backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[color:var(--accent-text)]">
                Community Network
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight">{title}</h1>
              <p className="mt-3 text-base leading-7 text-[color:color-mix(in_srgb,var(--foreground)_72%,transparent)]">
                {description}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={backHref}
                className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium transition hover:bg-[color:var(--surface-muted)]"
              >
                Back
              </Link>
              {secondaryHref && secondaryLabel ? (
                <Link
                  href={secondaryHref}
                  className="rounded-full bg-[color:var(--surface-strong)] px-4 py-2 text-sm font-semibold text-[color:var(--surface-strong-foreground)] transition hover:opacity-90"
                >
                  {secondaryLabel}
                </Link>
              ) : null}
            </div>
          </div>

          <div className="mt-6 inline-flex rounded-full border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-2 text-sm font-semibold">
            {statsLabel}
          </div>
        </section>

        {error ? (
          <div className="rounded-[2rem] border border-red-300/60 bg-red-100/70 p-6 text-red-800 shadow-sm">
            {error}
          </div>
        ) : null}

        <section className="space-y-4">
          <div className="flex flex-col gap-3 rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-[color:color-mix(in_srgb,var(--foreground)_68%,transparent)]">
              Showing {entries.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}-
              {Math.min(page * PAGE_SIZE, total)} of {total} {mode}
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
          {entries.length === 0 ? (
            <div className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-8 text-sm text-[color:color-mix(in_srgb,var(--foreground)_68%,transparent)] shadow-sm">
              {emptyMessage}
            </div>
          ) : (
            entries.map((entry) => (
              <article
                key={entry.user.id}
                className="flex flex-col gap-4 rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-4">
                  {entry.user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={entry.user.avatarUrl}
                      alt={`${entry.user.username} avatar`}
                      className="h-14 w-14 rounded-full border border-[color:var(--border)] bg-white object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-muted)] text-lg font-semibold uppercase">
                      {entry.user.username.slice(0, 2)}
                    </div>
                  )}

                  <div className="min-w-0">
                    <Link
                      href={`/users/${entry.user.id}`}
                      className="block truncate text-xl font-semibold tracking-tight hover:text-[color:var(--accent-text)]"
                    >
                      {entry.user.username}
                    </Link>
                    <p className="mt-1 text-sm text-[color:color-mix(in_srgb,var(--foreground)_65%,transparent)]">
                      Connected {formatDate(entry.followedAt)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/users/${entry.user.id}`}
                    className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium transition hover:bg-[color:var(--surface-muted)]"
                  >
                    View profile
                  </Link>
                  {!readOnly ? (
                    <button
                      type="button"
                      onClick={() => void handleAction(entry.user.id)}
                      disabled={busyUserId === entry.user.id}
                      className="rounded-full bg-[color:var(--surface-strong)] px-4 py-2 text-sm font-semibold text-[color:var(--surface-strong-foreground)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busyUserId === entry.user.id
                        ? "Updating..."
                        : mode === "followers"
                          ? "Remove follower"
                          : "Unfollow"}
                    </button>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
