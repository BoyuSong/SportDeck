"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers";

type DigestPost = {
  body: string;
  createdAt: string;
  id: number;
};

type DigestThread = {
  createdAt?: string;
  id: number;
  posts: DigestPost[];
  title: string;
  updatedAt?: string;
};

async function parseJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => null)) as
    | (Record<string, unknown> & T)
    | null;

  if (!response.ok) {
    const message =
      (data && typeof data.error === "string" && data.error) ||
      (data && typeof data.details === "string" && data.details) ||
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

export default function DigestPage() {
  const router = useRouter();
  const { accessToken, isAuthenticated, isLoading } = useAuth();

  const [digest, setDigest] = useState<DigestThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  async function loadDigest() {
    if (!accessToken) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await parseJson<DigestThread>(
        await fetch("/api/ai/digest", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
      );

      setDigest(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load daily digest");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDigest();
  }, [accessToken]);

  async function handleRefresh() {
    if (!accessToken) {
      setError("Sign in again to refresh the digest.");
      return;
    }

    setRefreshing(true);
    setError(null);

    try {
      const data = await parseJson<DigestThread>(
        await fetch("/api/ai/digest", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
      );

      setDigest(data);
    } catch (refreshError) {
      setError(
        refreshError instanceof Error ? refreshError.message : "Unable to refresh daily digest"
      );
    } finally {
      setRefreshing(false);
    }
  }

  if (isLoading || loading) {
    return (
      <main className="min-h-[calc(100vh-88px)] bg-[image:var(--hero-background)] px-6 py-10 text-[color:var(--foreground)]">
        <div className="mx-auto w-full max-w-5xl rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-8 shadow-sm">
          Loading daily digest...
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <main className="min-h-[calc(100vh-88px)] bg-[image:var(--hero-background)] px-6 py-10 text-[color:var(--foreground)]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <section className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-8 shadow-[var(--shadow-hero)] backdrop-blur">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[color:var(--accent-text)]">
                Daily Digest
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight">
                Catch up on the last 24 hours in one read.
              </h1>
              <p className="mt-3 text-base leading-7 text-[color:color-mix(in_srgb,var(--foreground)_72%,transparent)]">
                Pull together the biggest community debates, latest finished matches, and table movement without combing through every thread yourself.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {digest ? (
                <Link
                  href={`/threads/${digest.id}`}
                  className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium transition hover:bg-[color:var(--surface-muted)]"
                >
                  Open digest thread
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => void handleRefresh()}
                disabled={refreshing}
                className="rounded-full bg-[color:var(--surface-strong)] px-4 py-2 text-sm font-semibold text-[color:var(--surface-strong-foreground)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {refreshing ? "Refreshing..." : "Get today’s digest"}
              </button>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-[2rem] border border-red-300/60 bg-red-100/70 p-6 text-red-800 shadow-sm">
            {error}
          </div>
        ) : null}

        {digest ? (
          <section className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-8 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-3xl font-semibold tracking-tight">{digest.title}</h2>
                <p className="mt-2 text-sm text-[color:color-mix(in_srgb,var(--foreground)_68%,transparent)]">
                  {digest.createdAt ? `Created ${formatDate(digest.createdAt)}` : "Generated today"}
                </p>
              </div>
              <p className="text-sm text-[color:color-mix(in_srgb,var(--foreground)_68%,transparent)]">
                {digest.posts.length} digest post{digest.posts.length === 1 ? "" : "s"}
              </p>
            </div>

            <div className="mt-6 space-y-4">
              {digest.posts.map((post) => (
                <article
                  key={post.id}
                  className="rounded-[1.75rem] border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-5"
                >
                  <p className="text-sm text-[color:color-mix(in_srgb,var(--foreground)_65%,transparent)]">
                    Posted {formatDate(post.createdAt)}
                  </p>
                  <div className="mt-4 whitespace-pre-wrap leading-8 text-[color:color-mix(in_srgb,var(--foreground)_88%,transparent)]">
                    {post.body}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <section className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-8 shadow-sm">
            No digest is available yet. Generate today&apos;s digest to create the thread and load the summary.
          </section>
        )}
      </div>
    </main>
  );
}
