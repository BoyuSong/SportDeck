"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PersonalFeedSection } from "@/components/personal-feed-section";
import { useAuth } from "@/app/providers";

type Team = {
  crestUrl: string | null;
  id: number;
  name: string;
  shortName: string | null;
  venue: string | null;
};

type ProfileUser = {
  avatarUrl: string | null;
  createdAt: string;
  email: string;
  favoriteTeamId: number | null;
  id: number;
  role: "ADMIN" | "USER";
  updatedAt: string;
  username: string;
};

type UserDashboardData = {
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

type TeamsResponse = {
  teams: Team[];
  total: number;
};

type ProfileResponse = {
  user: ProfileUser;
};

type ContentTab = "posts" | "replies" | "threads";

const PAGE_SIZE = 10;
const NETWORK_PREVIEW_LIMIT = 4;

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

function getActivityTotal(day: UserDashboardData["activity"][number]) {
  return day.threads + day.posts + day.replies;
}

function trimPreview(value: string, limit = 180) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= limit) {
    return compact;
  }
  return `${compact.slice(0, limit - 1)}...`;
}

export default function ProfilePage() {
  const { accessToken, isAuthenticated, isLoading, refreshProfile, user } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [dashboardData, setDashboardData] = useState<UserDashboardData | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [followers, setFollowers] = useState<FollowListEntry[]>([]);
  const [following, setFollowing] = useState<FollowListEntry[]>([]);
  const [followersTotal, setFollowersTotal] = useState(0);
  const [followingTotal, setFollowingTotal] = useState(0);
  const [activeTab, setActiveTab] = useState<ContentTab>("threads");
  const [contentPage, setContentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [networkBusyKey, setNetworkBusyKey] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [favoriteTeamId, setFavoriteTeamId] = useState("");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    const currentUserId = user?.id;

    if (!accessToken || !currentUserId) {
      return;
    }

    let cancelled = false;

    async function loadProfileDashboard() {
      setLoading(true);
      setError(null);

      try {
        const [profileResponse, teamsResponse, dashboardResponse, followersResponse, followingResponse] =
          await Promise.all([
            fetch("/api/users/me", {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }),
            fetch("/api/league/teams", { cache: "no-store" }),
            fetch(
              `/api/users/${currentUserId}?content=${activeTab}&limit=${PAGE_SIZE}&offset=${(contentPage - 1) * PAGE_SIZE}`,
              { cache: "no-store" }
            ),
            fetch(`/api/users/me/followers?limit=${NETWORK_PREVIEW_LIMIT}&offset=0`, {
              cache: "no-store",
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }),
            fetch(`/api/users/me/following?limit=${NETWORK_PREVIEW_LIMIT}&offset=0`, {
              cache: "no-store",
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }),
          ]);

        const [profileJson, teamsJson, dashboardJson, followersJson, followingJson] =
          await Promise.all([
            parseJson<ProfileResponse>(profileResponse),
            parseJson<TeamsResponse>(teamsResponse),
            parseJson<UserDashboardData>(dashboardResponse),
            parseJson<FollowListResponse>(followersResponse),
            parseJson<FollowListResponse>(followingResponse),
          ]);

        if (cancelled) {
          return;
        }

        setProfile(profileJson.user);
        setTeams(teamsJson.teams);
        setDashboardData(dashboardJson);
        setFollowers(followersJson.items);
        setFollowing(followingJson.items);
        setFollowersTotal(followersJson.pagination.total);
        setFollowingTotal(followingJson.pagination.total);
        setUsername(profileJson.user.username);
        setAvatarUrl(profileJson.user.avatarUrl ?? "");
        setFavoriteTeamId(
          profileJson.user.favoriteTeamId === null
            ? ""
            : String(profileJson.user.favoriteTeamId)
        );
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Unable to load your dashboard"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProfileDashboard();
    return () => {
      cancelled = true;
    };
  }, [accessToken, activeTab, contentPage, user?.id]);

  useEffect(() => {
    setContentPage(1);
  }, [activeTab]);

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === Number(favoriteTeamId)) ?? null,
    [favoriteTeamId, teams]
  );

  const associatedTeamLabel =
    selectedTeam?.shortName ||
    selectedTeam?.name ||
    dashboardData?.user.favoriteTeam?.shortName ||
    dashboardData?.user.favoriteTeam?.name ||
    "Not set yet";

  const maxActivity = useMemo(() => {
    if (!dashboardData) {
      return 1;
    }
    return Math.max(1, ...dashboardData.activity.map(getActivityTotal));
  }, [dashboardData]);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      setSaveError("You need to sign in again before saving changes.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const response = await fetch("/api/users/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          avatarUrl: avatarUrl.trim() || null,
          favoriteTeamId: favoriteTeamId ? Number(favoriteTeamId) : null,
          username: username.trim(),
        }),
      });

      const json = await parseJson<ProfileResponse>(response);
      const nextTeam =
        teams.find((team) => team.id === json.user.favoriteTeamId) ?? null;

      setProfile(json.user);
      setUsername(json.user.username);
      setAvatarUrl(json.user.avatarUrl ?? "");
      setFavoriteTeamId(
        json.user.favoriteTeamId === null ? "" : String(json.user.favoriteTeamId)
      );
      setDashboardData((current) =>
        current
          ? {
              ...current,
              user: {
                ...current.user,
                username: json.user.username,
                avatarUrl: json.user.avatarUrl,
                favoriteTeamId: json.user.favoriteTeamId,
                favoriteTeam: nextTeam
                  ? {
                      id: nextTeam.id,
                      name: nextTeam.name,
                      shortName: nextTeam.shortName,
                      crestUrl: nextTeam.crestUrl,
                    }
                  : null,
              },
            }
          : current
      );
      await refreshProfile();
      setSaveSuccess("Dashboard profile updated successfully.");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Unable to save profile changes");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleNetworkAction(mode: "followers" | "following", targetUserId: number) {
    if (!accessToken) {
      setNetworkError("Sign in again to update your network.");
      return;
    }

    const busyKey = `${mode}-${targetUserId}`;
    setNetworkBusyKey(busyKey);
    setNetworkError(null);

    try {
      const response = await fetch(
        mode === "followers"
          ? `/api/users/me/followers/${targetUserId}`
          : `/api/users/${targetUserId}/follow`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      await parseJson<Record<string, unknown>>(response);

      if (mode === "followers") {
        setFollowers((current) => current.filter((entry) => entry.user.id !== targetUserId));
        setFollowersTotal((current) => Math.max(0, current - 1));
      } else {
        setFollowing((current) => current.filter((entry) => entry.user.id !== targetUserId));
        setFollowingTotal((current) => Math.max(0, current - 1));
      }

      setDashboardData((current) =>
        current
          ? {
              ...current,
              user: {
                ...current.user,
                counts: {
                  ...current.user.counts,
                  followers:
                    mode === "followers"
                      ? Math.max(0, current.user.counts.followers - 1)
                      : current.user.counts.followers,
                  following:
                    mode === "following"
                      ? Math.max(0, current.user.counts.following - 1)
                      : current.user.counts.following,
                },
              },
            }
          : current
      );
    } catch (actionError) {
      setNetworkError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to update this relationship."
      );
    } finally {
      setNetworkBusyKey(null);
    }
  }

  if (isLoading || loading) {
    return (
      <main className="min-h-[calc(100vh-88px)] bg-[image:var(--hero-background)] px-6 py-10 text-[color:var(--foreground)]">
        <div className="mx-auto w-full max-w-6xl rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-8 shadow-sm">
          Loading your dashboard...
        </div>
      </main>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <main className="min-h-[calc(100vh-88px)] bg-[image:var(--hero-background)] px-6 py-10 text-[color:var(--foreground)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        {error ? (
          <div className="rounded-[2rem] border border-red-300/60 bg-red-100/70 p-8 text-red-800 shadow-sm">
            {error}
          </div>
        ) : !dashboardData ? null : (
          <>
            <section className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-8 shadow-[var(--shadow-hero)] backdrop-blur">
              <div className="flex flex-col gap-6">
                <div>
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                    {avatarUrl.trim() ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatarUrl.trim()}
                        alt={`${username || user.username} avatar`}
                        className="h-24 w-24 rounded-full border border-[color:var(--border)] bg-white object-cover"
                      />
                    ) : (
                      <div className="flex h-24 w-24 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-muted)] text-3xl font-semibold uppercase text-[color:var(--foreground)]">
                        {(username || user.username).slice(0, 2)}
                      </div>
                    )}

                    <div className="max-w-3xl">
                      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[color:var(--accent-text)]">
                        Supporter Dashboard
                      </p>
                      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[color:var(--foreground)] sm:text-5xl">
                        {username || user.username}
                      </h1>
                      <p className="mt-3 max-w-2xl text-base leading-7 text-[color:color-mix(in_srgb,var(--foreground)_72%,transparent)]">
                        One calmer place for your profile, network, recent contributions,
                        and personalized team and community updates.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link
                      href={`/users/${user.id}`}
                      className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium transition hover:bg-[color:var(--surface-muted)]"
                    >
                      View public profile
                    </Link>
                    <Link
                      href="/profile?section=feed"
                      className="rounded-full bg-[color:var(--surface-strong)] px-4 py-2 text-sm font-semibold text-[color:var(--surface-strong-foreground)] transition hover:opacity-90"
                    >
                      Jump to feed
                    </Link>
                    <Link
                      href="/profile/followers"
                      className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium transition hover:bg-[color:var(--surface-muted)]"
                    >
                      Manage followers
                    </Link>
                  </div>
                </div>

                <div className="rounded-[1.75rem] border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:color-mix(in_srgb,var(--foreground)_58%,transparent)]">
                    Snapshot
                  </p>
                  <div className="mt-5 space-y-4">
                    <div className="rounded-2xl bg-[color:var(--surface)] px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-[color:color-mix(in_srgb,var(--foreground)_55%,transparent)]">
                        Associated Team
                      </p>
                      <p className="mt-2 text-xl font-semibold">{associatedTeamLabel}</p>
                    </div>
                    <div className="flex flex-col gap-4">
                      <div className="rounded-2xl bg-[color:var(--surface)] px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-[color:color-mix(in_srgb,var(--foreground)_55%,transparent)]">
                          Member Since
                        </p>
                        <p className="mt-2 text-base font-semibold">
                          {formatDate(profile?.createdAt ?? dashboardData.user.createdAt)}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-[color:var(--surface)] px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-[color:color-mix(in_srgb,var(--foreground)_55%,transparent)]">
                          Role
                        </p>
                        <p className="mt-2 text-base font-semibold">
                          {profile?.role ?? user.role}
                        </p>
                      </div>
                    </div>
                    <Link
                      href="/profile/following"
                      className="inline-flex w-full items-center justify-center rounded-full border border-[color:var(--border)] px-4 py-3 text-sm font-medium transition hover:bg-[color:var(--surface)]"
                    >
                      Open following list
                    </Link>
                  </div>
                </div>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
                <Link
                  href="/profile/followers"
                  className="rounded-2xl bg-[color:var(--surface-muted)] p-4 transition hover:bg-[color:var(--surface)]"
                >
                  <p className="text-xs uppercase tracking-[0.18em]">Followers</p>
                  <p className="mt-2 text-3xl font-semibold">{dashboardData.user.counts.followers}</p>
                </Link>
                <Link
                  href="/profile/following"
                  className="rounded-2xl bg-[color:var(--surface-muted)] p-4 transition hover:bg-[color:var(--surface)]"
                >
                  <p className="text-xs uppercase tracking-[0.18em]">Following</p>
                  <p className="mt-2 text-3xl font-semibold">{dashboardData.user.counts.following}</p>
                </Link>
                <div className="rounded-2xl bg-[color:var(--surface-muted)] p-4">
                  <p className="text-xs uppercase tracking-[0.18em]">Threads</p>
                  <p className="mt-2 text-3xl font-semibold">{dashboardData.user.counts.threads}</p>
                </div>
                <div className="rounded-2xl bg-[color:var(--surface-muted)] p-4">
                  <p className="text-xs uppercase tracking-[0.18em]">Posts</p>
                  <p className="mt-2 text-3xl font-semibold">{dashboardData.user.counts.posts}</p>
                </div>
                <div className="rounded-2xl bg-[color:var(--surface-muted)] p-4">
                  <p className="text-xs uppercase tracking-[0.18em]">Replies</p>
                  <p className="mt-2 text-3xl font-semibold">{dashboardData.user.counts.replies}</p>
                </div>
                <Link
                  href="/profile?section=feed"
                  className="rounded-2xl bg-[color:var(--surface-strong)] p-4 text-[color:var(--surface-strong-foreground)] transition hover:opacity-90"
                >
                  <p className="text-xs uppercase tracking-[0.18em] text-current/70">Feed</p>
                  <p className="mt-2 text-3xl font-semibold">Open</p>
                </Link>
              </div>
            </section>

            <section className="flex flex-col gap-6">
              <section className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[color:var(--accent-text)]">
                      Activity View
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
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

                <div className="mt-6 grid grid-cols-10 gap-2 md:grid-cols-15 lg:grid-cols-30 2xl:grid-cols-15">
                  {dashboardData.activity.map((day) => {
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
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[color:var(--accent-text)]">
                        Contribution Stream
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
                        Recent contributions
                      </h2>
                      <p className="mt-2 text-sm text-[color:color-mix(in_srgb,var(--foreground)_68%,transparent)]">
                        Review your latest threads, posts, and replies without
                        squeezing them beside utility panels.
                      </p>
                    </div>
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
                      {dashboardData.recentPagination.total === 0
                        ? 0
                        : dashboardData.recentPagination.offset + 1}
                      -
                      {Math.min(
                        dashboardData.recentPagination.offset +
                          dashboardData.recent[activeTab].length,
                        dashboardData.recentPagination.total
                      )}{" "}
                      of {dashboardData.recentPagination.total} {activeTab}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setContentPage((current) => Math.max(1, current - 1))
                        }
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
                        disabled={
                          dashboardData.recentPagination.offset +
                            dashboardData.recentPagination.limit >=
                          dashboardData.recentPagination.total
                        }
                        className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-semibold transition hover:bg-[color:var(--surface)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Next
                      </button>
                    </div>
                  </div>

                  {activeTab === "threads" && (
                    <>
                      {dashboardData.recent.threads.length === 0 ? (
                        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-5 text-sm text-[color:color-mix(in_srgb,var(--foreground)_65%,transparent)]">
                          No recent threads yet.
                        </div>
                      ) : (
                        dashboardData.recent.threads.map((thread) => (
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
                              <Link
                                href={`/threads/${thread.id}`}
                                className="hover:text-[color:var(--accent-text)]"
                              >
                                {thread.title}
                              </Link>
                            </h3>
                            {thread.match ? (
                              <p className="mt-2 text-sm text-[color:color-mix(in_srgb,var(--foreground)_65%,transparent)]">
                                {thread.match.homeTeam.shortName ||
                                  thread.match.homeTeam.name}{" "}
                                vs{" "}
                                {thread.match.awayTeam.shortName ||
                                  thread.match.awayTeam.name}
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
                      {dashboardData.recent.posts.length === 0 ? (
                        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-5 text-sm text-[color:color-mix(in_srgb,var(--foreground)_65%,transparent)]">
                          No recent posts yet.
                        </div>
                      ) : (
                        dashboardData.recent.posts.map((post) => (
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
                              <Link
                                href={`/threads/${post.thread.id}`}
                                className="hover:text-[color:var(--accent-text)]"
                              >
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
                      {dashboardData.recent.replies.length === 0 ? (
                        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-5 text-sm text-[color:color-mix(in_srgb,var(--foreground)_65%,transparent)]">
                          No recent replies yet.
                        </div>
                      ) : (
                        dashboardData.recent.replies.map((reply) => (
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
            </section>

            <PersonalFeedSection refreshKey={profile?.favoriteTeamId ?? "none"} />

            <section className="flex flex-col gap-6">
              <section className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm">
                  <h2 className="text-2xl font-semibold tracking-tight">Edit details</h2>
                  <p className="mt-2 text-sm leading-6 text-[color:color-mix(in_srgb,var(--foreground)_68%,transparent)]">
                    Keep your identity, avatar, and favorite club in sync with how the
                    community sees you.
                  </p>

                  <form onSubmit={handleSave} className="mt-6 space-y-5">
                    <div>
                      <label className="mb-2 block text-sm font-medium">Email address</label>
                      <input
                        value={profile?.email ?? user.email}
                        disabled
                        className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3 text-[color:color-mix(in_srgb,var(--foreground)_60%,transparent)] outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium">Username</label>
                      <input
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3 outline-none transition focus:border-[color:var(--accent-text)]"
                        placeholder="Choose a display name"
                        required
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium">Avatar URL</label>
                      <input
                        value={avatarUrl}
                        onChange={(event) => setAvatarUrl(event.target.value)}
                        className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3 outline-none transition focus:border-[color:var(--accent-text)]"
                        placeholder="https://example.com/avatar.jpg"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium">Associated team</label>
                      <select
                        value={favoriteTeamId}
                        onChange={(event) => setFavoriteTeamId(event.target.value)}
                        className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3 outline-none transition focus:border-[color:var(--accent-text)]"
                      >
                        <option value="">No favorite team yet</option>
                        {teams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.shortName || team.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedTeam?.venue ? (
                      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3 text-sm text-[color:color-mix(in_srgb,var(--foreground)_68%,transparent)]">
                        Home venue: {selectedTeam.venue}
                      </div>
                    ) : null}

                    {saveError ? (
                      <div className="rounded-2xl border border-red-300/60 bg-red-100/70 px-4 py-3 text-sm text-red-800">
                        {saveError}
                      </div>
                    ) : null}

                    {saveSuccess ? (
                      <div className="rounded-2xl border border-emerald-300/60 bg-emerald-100/70 px-4 py-3 text-sm text-emerald-800">
                        {saveSuccess}
                      </div>
                    ) : null}

                    <button
                      type="submit"
                      disabled={isSaving}
                      className="w-full rounded-2xl bg-[color:var(--surface-strong)] px-4 py-3 text-sm font-semibold text-[color:var(--surface-strong-foreground)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSaving ? "Saving changes..." : "Save profile"}
                    </button>
                  </form>
              </section>

              <section className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[color:var(--accent-text)]">
                      Community Network
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight">Followers and following</h2>
                    <p className="mt-2 text-sm leading-6 text-[color:color-mix(in_srgb,var(--foreground)_68%,transparent)]">
                      Your most recent follow relationships, sorted by when they happened,
                      with removal tools close at hand.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3 text-sm">
                    {followersTotal + followingTotal} visible connections
                  </div>
                </div>

                {networkError ? (
                  <div className="mt-5 rounded-2xl border border-red-300/60 bg-red-100/70 px-4 py-3 text-sm text-red-800">
                    {networkError}
                  </div>
                ) : null}

                <div className="mt-6 space-y-6">
                  {(
                    [
                      {
                        ctaHref: "/profile/followers",
                        ctaLabel: "View all followers",
                        emptyMessage: "No followers yet.",
                        entries: followers,
                        mode: "followers" as const,
                        title: `Followers (${followersTotal})`,
                      },
                      {
                        ctaHref: "/profile/following",
                        ctaLabel: "View all following",
                        emptyMessage: "You are not following anyone yet.",
                        entries: following,
                        mode: "following" as const,
                        title: `Following (${followingTotal})`,
                      },
                    ] satisfies Array<{
                      ctaHref: string;
                      ctaLabel: string;
                      emptyMessage: string;
                      entries: FollowListEntry[];
                      mode: "followers" | "following";
                      title: string;
                    }>
                  ).map((section) => (
                    <div key={section.mode} className="rounded-[1.75rem] border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-5">
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="text-xl font-semibold tracking-tight">
                          {section.title}
                        </h3>
                        <Link
                          href={section.ctaHref}
                          className="text-sm font-semibold text-[color:var(--accent-text)] hover:underline"
                        >
                          {section.ctaLabel}
                        </Link>
                      </div>

                      {section.entries.length === 0 ? (
                        <div className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-4 text-sm text-[color:color-mix(in_srgb,var(--foreground)_65%,transparent)]">
                          {section.emptyMessage}
                        </div>
                      ) : (
                        <div className="mt-4 space-y-3">
                          {section.entries.map((entry) => {
                            const busyKey = `${section.mode}-${entry.user.id}`;

                            return (
                              <article
                                key={`${section.mode}-${entry.user.id}`}
                                className="flex flex-col gap-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4"
                              >
                                <div className="flex min-w-0 items-center gap-4">
                                  {entry.user.avatarUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={entry.user.avatarUrl}
                                      alt={`${entry.user.username} avatar`}
                                      className="h-12 w-12 rounded-full border border-[color:var(--border)] bg-white object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-muted)] text-base font-semibold uppercase">
                                      {entry.user.username.slice(0, 2)}
                                    </div>
                                  )}

                                  <div className="min-w-0">
                                    <Link
                                      href={`/users/${entry.user.id}`}
                                      className="block truncate text-lg font-semibold tracking-tight hover:text-[color:var(--accent-text)]"
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
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleNetworkAction(section.mode, entry.user.id)
                                    }
                                    disabled={networkBusyKey === busyKey}
                                    className="rounded-full bg-[color:var(--surface-strong)] px-4 py-2 text-sm font-semibold text-[color:var(--surface-strong-foreground)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {networkBusyKey === busyKey
                                      ? "Updating..."
                                      : section.mode === "followers"
                                        ? "Remove follower"
                                        : "Unfollow"}
                                  </button>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
