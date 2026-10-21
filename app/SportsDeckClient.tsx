"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

type ThemeMode = "light" | "dark";
type Tone = "info" | "success" | "error";
type ThreadType = "ALL" | "GENERAL" | "TEAM" | "MATCH";
type MatchWindow = "all" | "upcoming" | "recent";
type UserRole = "USER" | "ADMIN";
type BanStatus = "NOT_BANNED" | "BANNED";

type SessionUser = {
  avatarUrl: string | null;
  banReason?: string | null;
  banStatus?: BanStatus;
  bannedAt?: string | null;
  email: string;
  favoriteTeamId: number | null;
  id: number;
  role: UserRole;
  username: string;
};

type AuthSession = {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  user: SessionUser;
};

type OAuthConfig = {
  providers: {
    github: {
      clientId: string | null;
      enabled: boolean;
    };
    google: {
      clientId: string | null;
      enabled: boolean;
    };
  };
};

type Team = {
  crestUrl: string | null;
  id: number;
  name: string;
  shortName: string | null;
  venue: string | null;
};

type MatchCard = {
  awayTeam: {
    crestUrl: string | null;
    id: number;
    name: string;
    score: number | null;
    shortName: string | null;
  };
  homeTeam: {
    crestUrl: string | null;
    id: number;
    name: string;
    score: number | null;
    shortName: string | null;
  };
  id: number;
  matchday: number | null;
  stage: string | null;
  status: string;
  utcDate: string;
  venue: string | null;
};

type MatchesPayload = {
  filters: {
    available: {
      matchdays: number[];
      stages: string[];
    };
  };
  matches: MatchCard[];
  total: number;
};

type StandingsSnapshotPayload = {
  snapshot: {
    competition: unknown;
    fetchedAt: string;
    season: string;
    standings: unknown[];
  };
};

type ParsedStandingRow = {
  crestUrl: string | null;
  draw: number | null;
  lost: number | null;
  played: number | null;
  points: number | null;
  position: number | null;
  team: string;
  won: number | null;
};

type ThreadSummary = {
  author: {
    id: number;
    username: string;
  } | null;
  createdAt: string;
  id: number;
  isOpenForPosting: boolean;
  match: {
    awayTeam: {
      name: string;
      shortName: string | null;
    };
    homeTeam: {
      name: string;
      shortName: string | null;
    };
    utcDate: string;
  } | null;
  matchId: number | null;
  tags: string[];
  team: {
    id: number;
    name: string;
    shortName: string | null;
  } | null;
  title: string;
  type: Exclude<ThreadType, "ALL">;
  updatedAt: string;
  _count: {
    polls: number;
    posts: number;
  };
};

type ThreadsPayload = {
  threads: ThreadSummary[];
  total: number;
};

type ThreadCommentAuthor = {
  avatarUrl: string | null;
  id: number;
  username: string;
};

type ThreadReply = {
  author: ThreadCommentAuthor;
  authorId: number;
  body: string;
  createdAt: string;
  id: number;
};

type ThreadPost = {
  author: ThreadCommentAuthor;
  authorId: number;
  body: string;
  createdAt: string;
  id: number;
  replies: ThreadReply[];
};

type ThreadPoll = {
  authorId: number;
  deadline: string;
  id: number;
  isVotingOpen: boolean;
  options: Array<{
    id: number;
    text: string;
    votes: number;
  }>;
  question: string;
  totalVotes: number;
};

type ThreadDetail = {
  author: ThreadCommentAuthor | null;
  authorId: number | null;
  id: number;
  isOpenForPosting: boolean;
  match: {
    awayTeam: Team;
    homeTeam: Team;
    scoreAway: number | null;
    scoreHome: number | null;
    status: string;
    utcDate: string;
    venue: string | null;
  } | null;
  polls: ThreadPoll[];
  posts: ThreadPost[];
  tags: string[];
  title: string;
  type: Exclude<ThreadType, "ALL">;
  updatedAt: string;
};

type ThreadDetailPayload = {
  thread: ThreadDetail;
};

type RevisionPayload = {
  revisions: Array<{
    createdAt: string;
    editor: {
      username: string;
    };
    id: number;
    previousBody: string;
  }>;
};

type SentimentPayload = {
  awayFanCommentCount: number;
  awayTeam: string;
  commentCount: number;
  homeFanCommentCount: number;
  homeTeam: string;
  overall: string;
};

type UserProfilePayload = {
  activity: Array<{
    date: string;
    posts: number;
    replies: number;
    threads: number;
  }>;
  recent: {
    posts: Array<{
      body: string;
      id: number;
      thread: {
        id: number;
        title: string;
      };
    }>;
    replies: Array<{
      body: string;
      id: number;
      post: {
        thread: {
          id: number;
          title: string;
        };
      };
    }>;
    threads: Array<{
      _count: {
        polls: number;
        posts: number;
      };
      id: number;
      title: string;
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
    favoriteTeam: Team | null;
    id: number;
    username: string;
  };
};

type FeedPayload = {
  items: Array<{
    actors: Array<{
      avatarUrl: string | null;
      id: number;
      username: string;
    }>;
    count: number;
    id: number;
    latestAt: string;
    summary: string;
  }>;
};

type FollowListItem = {
  followedAt: string;
  user: {
    avatarUrl: string | null;
    favoriteTeamId?: number | null;
    id: number;
    username: string;
  };
};

type FollowListResponse = {
  items: FollowListItem[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
};

type ReportQueueItem = {
  aiVerdict: {
    explanation: string | null;
    label: string;
    score: number;
  };
  latestReportedAt: string;
  reportCount: number;
  reports: Array<{
    id: number;
    reason: string;
    reporter: {
      username: string;
    };
  }>;
  target: {
    body?: string;
    id: number;
    title?: string;
  };
  targetId: number | null;
  targetType: "post" | "reply" | "thread";
};

type AppealItem = {
  id: number;
  message: string;
  status: string;
  user: {
    banReason: string | null;
    bannedAt: string | null;
    username: string;
  };
};

type DigestThread = {
  id: number;
  posts: Array<{
    body: string;
    createdAt: string;
  }>;
  title: string;
};

type FlashMessage = {
  text: string;
  tone: Tone;
};

const SESSION_STORAGE_KEY = "sportsdeck.session.v2";
const THEME_STORAGE_KEY = "sportsdeck.theme.v1";
const OAUTH_STORAGE_KEY = "sportsdeck.oauth.state.v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function readString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function readNumber(value: unknown) {
  return typeof value === "number" ? value : null;
}

function getInitials(label: string) {
  return label
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return "TBD";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatCompactDate(value: string | null | undefined) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
}

function formatJoinedDate(value: string | null | undefined) {
  if (!value) return "Recently";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date(value));
}

function truncate(value: string, length = 130) {
  return value.length > length ? `${value.slice(0, length).trim()}...` : value;
}

function parseTagInput(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
}

function extractStandingsRows(payload: StandingsSnapshotPayload | null) {
  if (!payload) return [] as ParsedStandingRow[];
  const sections = safeArray<Record<string, unknown>>(payload.snapshot.standings);
  const firstTable = sections.find((section) => Array.isArray(section.table));
  if (!firstTable) return [] as ParsedStandingRow[];

  return safeArray<Record<string, unknown>>(firstTable.table).map((row) => {
    const team = isRecord(row.team) ? row.team : {};
    return {
      position: readNumber(row.position),
      team: readString(team.name) ?? "Unknown Team",
      crestUrl: readString((team as Record<string, unknown>).crest),
      played: readNumber(row.playedGames),
      won: readNumber(row.won),
      draw: readNumber(row.draw),
      lost: readNumber(row.lost),
      points: readNumber(row.points),
    };
  });
}

function extractCompetitionName(payload: StandingsSnapshotPayload | null) {
  if (!payload || !isRecord(payload.snapshot.competition)) return "League Table";
  return readString(payload.snapshot.competition.name) ?? "League Table";
}

function moodTone(label: string | null | undefined) {
  const normalized = String(label ?? "").toLowerCase();
  if (normalized === "positive") return "text-emerald-300";
  if (normalized === "negative") return "text-rose-300";
  return "text-amber-200";
}

async function readJson<T>(response: Response) {
  const data = (await response.json().catch(() => null)) as T | null;
  if (!response.ok) {
    const message =
      isRecord(data) && typeof data.error === "string"
        ? data.error
        : isRecord(data) && typeof data.message === "string"
          ? data.message
          : `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  return data as T;
}

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[28px] border border-[color:var(--border)] bg-[color:var(--panel)] p-5 shadow-[var(--panel-shadow)] backdrop-blur-xl",
        className
      )}
    >
      {children}
    </div>
  );
}

function SectionTitle({
  action,
  description,
  eyebrow,
  title,
}: {
  action?: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[color:var(--muted)]">{eyebrow}</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[color:var(--text)] sm:text-4xl">{title}</h2>
        <p className="mt-3 text-sm leading-7 text-[color:var(--muted)] sm:text-base">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function Avatar({
  image,
  label,
  size = "md",
}: {
  image: string | null | undefined;
  label: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass = {
    sm: "h-9 w-9 text-xs",
    md: "h-12 w-12 text-sm",
    lg: "h-16 w-16 text-lg",
  }[size];

  if (image) {
    return (
      <img
        alt={label}
        className={cn("rounded-full border border-white/30 object-cover shadow-lg", sizeClass)}
        loading="lazy"
        src={image}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full border border-white/20 bg-[linear-gradient(135deg,var(--accent),var(--accent-2))] font-semibold text-white shadow-lg",
        sizeClass
      )}
    >
      {getInitials(label)}
    </div>
  );
}

function ActivityChart({ activity }: { activity: UserProfilePayload["activity"] }) {
  const maxValue = Math.max(1, ...activity.map((entry) => entry.posts + entry.replies + entry.threads));
  return (
    <div className="grid grid-cols-10 gap-2 sm:grid-cols-15">
      {activity.map((entry) => {
        const total = entry.posts + entry.replies + entry.threads;
        const height = Math.max(10, Math.round((total / maxValue) * 100));
        return (
          <div className="flex flex-col items-center gap-2" key={entry.date}>
            <div className="flex h-28 w-full items-end rounded-2xl bg-[color:var(--soft)] px-1 py-1">
              <div
                className="w-full rounded-xl bg-[linear-gradient(180deg,var(--accent),var(--accent-2))]"
                style={{ height: `${height}%` }}
                title={`${entry.date}: ${total} actions`}
              />
            </div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
              {formatCompactDate(entry.date)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function SportsDeckClient({
  initialView = "overview",
}: {
  initialView?: "overview" | "matches" | "forums" | "community" | "account" | "admin";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [flash, setFlash] = useState<FlashMessage | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [isBooting, setIsBooting] = useState(true);

  const [session, setSession] = useState<AuthSession | null>(null);
  const sessionRef = useRef<AuthSession | null>(null);

  const [oauthConfig, setOauthConfig] = useState<OAuthConfig | null>(null);
  const [oauthBusy, setOauthBusy] = useState<string | null>(null);

  const [teams, setTeams] = useState<Team[]>([]);
  const [standings, setStandings] = useState<StandingsSnapshotPayload | null>(null);
  const [matchesPayload, setMatchesPayload] = useState<MatchesPayload | null>(null);
  const [threadsPayload, setThreadsPayload] = useState<ThreadsPayload | null>(null);
  const [selectedThread, setSelectedThread] = useState<ThreadDetail | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [selectedSentiment, setSelectedSentiment] = useState<SentimentPayload | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUserProfile, setSelectedUserProfile] = useState<UserProfilePayload | null>(null);
  const [feed, setFeed] = useState<FeedPayload | null>(null);
  const [following, setFollowing] = useState<FollowListItem[]>([]);
  const [followers, setFollowers] = useState<FollowListItem[]>([]);
  const [digest, setDigest] = useState<DigestThread | null>(null);
  const [reportsQueue, setReportsQueue] = useState<ReportQueueItem[]>([]);
  const [appeals, setAppeals] = useState<AppealItem[]>([]);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [revisionViewer, setRevisionViewer] = useState<{
    id: number;
    items: RevisionPayload["revisions"];
    kind: "post" | "reply";
  } | null>(null);

  const [matchesLoading, setMatchesLoading] = useState(false);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [threadDetailLoading, setThreadDetailLoading] = useState(false);

  const [matchWindow, setMatchWindow] = useState<MatchWindow>("upcoming");
  const [matchdayFilter, setMatchdayFilter] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");

  const [threadQuery, setThreadQuery] = useState("");
  const [threadAuthorFilter, setThreadAuthorFilter] = useState("");
  const [threadTagFilter, setThreadTagFilter] = useState("");
  const [threadTypeFilter, setThreadTypeFilter] = useState<ThreadType>("ALL");
  const [threadTeamFilter, setThreadTeamFilter] = useState<string>("all");
  const deferredThreadQuery = useDeferredValue(threadQuery);
  const deferredThreadAuthor = useDeferredValue(threadAuthorFilter);
  const deferredThreadTag = useDeferredValue(threadTagFilter);

  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authForm, setAuthForm] = useState({ email: "", password: "", username: "" });
  const [profileForm, setProfileForm] = useState({ avatarUrl: "", favoriteTeamId: "", username: "" });
  const [threadComposer, setThreadComposer] = useState({
    body: "",
    tags: "",
    teamId: "",
    title: "",
    type: "GENERAL" as "GENERAL" | "TEAM",
  });
  const [threadEdit, setThreadEdit] = useState({ tags: "", title: "" });
  const [newPostBody, setNewPostBody] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [pollComposer, setPollComposer] = useState({ deadline: "", options: "", question: "" });
  const [appealMessage, setAppealMessage] = useState("");
  const [moderationNote, setModerationNote] = useState<Record<string, string>>({});

  const currentUser = session?.user ?? null;
  const standingsRows = useMemo(() => extractStandingsRows(standings), [standings]);
  const featuredTeams = useMemo(() => teams.slice(0, 10), [teams]);
  const selectedUserIsFollowed = useMemo(() => {
    if (!selectedUserId) return false;
    return following.some((entry) => entry.user.id === selectedUserId);
  }, [following, selectedUserId]);
  const heroMatch = matchesPayload?.matches[0] ?? null;
  const threadQueryParam = searchParams.get("thread");
  const userQueryParam = searchParams.get("user");
  const showOverview = initialView === "overview";
  const showMatches = initialView === "matches";
  const showForums = initialView === "forums";
  const showCommunity = initialView === "community";
  const showAccount = initialView === "account";
  const showAdmin = initialView === "admin";

  function showFlash(text: string, tone: Tone = "info") {
    setFlash({ text, tone });
  }

  function persistTheme(nextTheme: ThemeMode) {
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  }

  function persistSession(nextSession: AuthSession | null) {
    sessionRef.current = nextSession;
    setSession(nextSession);

    if (!nextSession) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
  }

  async function apiFetch<T>(path: string, init?: RequestInit, options?: { auth?: boolean; retry?: boolean }) {
    const auth = options?.auth ?? false;
    const retry = options?.retry ?? true;
    const headers = new Headers(init?.headers);

    if (!(init?.body instanceof FormData) && !headers.has("Content-Type") && init?.method !== "GET") {
      headers.set("Content-Type", "application/json");
    }

    if (auth) {
      const token = sessionRef.current?.accessToken;
      if (!token) throw new Error("Please sign in first.");
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(path, { ...init, cache: "no-store", headers });
    if (response.status === 401 && auth && retry && sessionRef.current?.refreshToken) {
      const refreshed = await refreshSession();
      if (refreshed) return apiFetch<T>(path, init, { auth, retry: false });
    }
    return readJson<T>(response);
  }

  async function refreshSession() {
    const current = sessionRef.current;
    if (!current?.refreshToken) {
      persistSession(null);
      return false;
    }

    try {
      const refreshed = await apiFetch<{
        accessToken: string;
        accessTokenExpiresAt: string;
        refreshToken: string;
      }>(
        "/api/auth/refresh",
        {
          body: JSON.stringify({ refreshToken: current.refreshToken }),
          method: "POST",
        },
        { auth: false, retry: false }
      );

      persistSession({
        ...current,
        accessToken: refreshed.accessToken,
        accessTokenExpiresAt: refreshed.accessTokenExpiresAt,
        refreshToken: refreshed.refreshToken,
      });
      return true;
    } catch {
      persistSession(null);
      return false;
    }
  }

  async function loadPublicData() {
    try {
      const [oauth, standingsPayload, teamsPayload] = await Promise.all([
        apiFetch<OAuthConfig>("/api/auth/oauth/config", undefined, { auth: false, retry: false }),
        apiFetch<StandingsSnapshotPayload>("/api/league/standings", undefined, { auth: false, retry: false }),
        apiFetch<{ teams: Team[] }>("/api/league/teams", undefined, { auth: false, retry: false }),
      ]);
      setOauthConfig(oauth);
      setStandings(standingsPayload);
      setTeams(teamsPayload.teams);
    } catch (error) {
      console.error(error);
    }

    try {
      const digestPayload = await apiFetch<DigestThread>("/api/digest/today", undefined, { auth: false, retry: false });
      setDigest(digestPayload);
    } catch (error) {
      console.error(error);
    }
  }

  async function loadMatches() {
    setMatchesLoading(true);
    try {
      const query = new URLSearchParams();
      query.set("window", matchWindow);
      query.set("limit", "8");
      if (matchdayFilter !== "all") query.set("matchday", matchdayFilter);
      if (stageFilter !== "all") query.set("stage", stageFilter);

      const payload = await apiFetch<MatchesPayload>(`/api/league/matches?${query.toString()}`, undefined, {
        auth: false,
        retry: false,
      });
      setMatchesPayload(payload);
    } catch (error) {
      console.error(error);
      showFlash(error instanceof Error ? error.message : "Could not load matches", "error");
    } finally {
      setMatchesLoading(false);
    }
  }

  async function loadThreads() {
    setThreadsLoading(true);
    try {
      const query = new URLSearchParams();
      query.set("limit", "18");
      if (threadTypeFilter !== "ALL") query.set("type", threadTypeFilter);
      if (threadTeamFilter !== "all") query.set("teamId", threadTeamFilter);
      if (deferredThreadQuery.trim()) query.set("q", deferredThreadQuery.trim());
      if (deferredThreadAuthor.trim()) query.set("author", deferredThreadAuthor.trim());
      for (const tag of parseTagInput(deferredThreadTag)) {
        query.append("tag", tag);
      }

      const payload = await apiFetch<ThreadsPayload>(`/api/threads?${query.toString()}`, undefined, {
        auth: false,
        retry: false,
      });
      setThreadsPayload(payload);

      const nextSelected =
        payload.threads.find((thread) => thread.id === selectedThreadId)?.id ?? payload.threads[0]?.id ?? null;
      setSelectedThreadId(nextSelected);
    } catch (error) {
      console.error(error);
      showFlash(error instanceof Error ? error.message : "Could not load threads", "error");
    } finally {
      setThreadsLoading(false);
    }
  }

  async function loadSelectedThread(threadId: number) {
    setThreadDetailLoading(true);
    setRevisionViewer(null);
    try {
      const payload = await apiFetch<ThreadDetailPayload>(`/api/threads/${threadId}`, undefined, {
        auth: false,
        retry: false,
      });
      setSelectedThread(payload.thread);
      setThreadEdit({ tags: payload.thread.tags.join(", "), title: payload.thread.title });

      if (payload.thread.type === "MATCH") {
        try {
          const sentiment = await apiFetch<SentimentPayload>(`/api/ai/sentiment/${threadId}`, undefined, {
            auth: false,
            retry: false,
          });
          setSelectedSentiment(sentiment);
        } catch {
          setSelectedSentiment(null);
        }
      } else {
        setSelectedSentiment(null);
      }
    } catch (error) {
      console.error(error);
      setSelectedThread(null);
      showFlash(error instanceof Error ? error.message : "Could not open thread", "error");
    } finally {
      setThreadDetailLoading(false);
    }
  }

  async function loadSelectedUser(userId: number) {
    try {
      const payload = await apiFetch<UserProfilePayload>(`/api/users/${userId}`, undefined, {
        auth: false,
        retry: false,
      });
      setSelectedUserProfile(payload);
    } catch (error) {
      console.error(error);
    }
  }

  async function loadPrivateData() {
    if (!sessionRef.current) {
      setFeed(null);
      setFollowing([]);
      setFollowers([]);
      setReportsQueue([]);
      setAppeals([]);
      return;
    }

    try {
      const results = await Promise.allSettled([
        apiFetch<{ user: SessionUser }>("/api/users/me", undefined, { auth: true }),
        apiFetch<FeedPayload>("/api/feed", undefined, { auth: true }),
        apiFetch<FollowListResponse>("/api/users/me/following", undefined, { auth: true }),
        apiFetch<FollowListResponse>("/api/users/me/followers", undefined, { auth: true }),
      ]);

      const meResult = results[0];
      if (meResult.status === "fulfilled") {
        persistSession({ ...sessionRef.current!, user: { ...sessionRef.current!.user, ...meResult.value.user } });
        setProfileForm({
          username: meResult.value.user.username,
          avatarUrl: meResult.value.user.avatarUrl ?? "",
          favoriteTeamId: meResult.value.user.favoriteTeamId ? String(meResult.value.user.favoriteTeamId) : "",
        });
        if (!selectedUserId) {
          setSelectedUserId(meResult.value.user.id);
        }
      }

      if (results[1].status === "fulfilled") setFeed(results[1].value);
      if (results[2].status === "fulfilled") setFollowing(results[2].value.items);
      if (results[3].status === "fulfilled") setFollowers(results[3].value.items);

      if ((meResult.status === "fulfilled" ? meResult.value.user.role : currentUser?.role) === "ADMIN") {
        const adminResults = await Promise.allSettled([
          apiFetch<ReportQueueItem[]>("/api/admin/reports", undefined, { auth: true }),
          apiFetch<AppealItem[]>("/api/admin/appeals", undefined, { auth: true }),
        ]);

        if (adminResults[0].status === "fulfilled") setReportsQueue(adminResults[0].value);
        if (adminResults[1].status === "fulfilled") setAppeals(adminResults[1].value);
      }
    } catch (error) {
      console.error(error);
    }
  }

  async function completeOauthCallback() {
    const savedState = window.localStorage.getItem(OAUTH_STORAGE_KEY);
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const code = searchParams.get("code");
    const searchState = searchParams.get("state");
    const idToken = hashParams.get("id_token");
    const hashState = hashParams.get("state");

    if (!savedState) {
      setOauthBusy(null);
      return;
    }

    try {
      if (code && searchState === savedState) {
        const payload = await apiFetch<{
          accessToken: string;
          accessTokenExpiresAt: string;
          refreshToken: string;
          user: SessionUser;
        }>(
          "/api/auth/oauth",
          {
            body: JSON.stringify({ code, provider: "github" }),
            method: "POST",
          },
          { auth: false, retry: false }
        );
        persistSession(payload);
        showFlash("Signed in with GitHub.", "success");
      }

      if (idToken && hashState === savedState) {
        const payload = await apiFetch<{
          accessToken: string;
          accessTokenExpiresAt: string;
          refreshToken: string;
          user: SessionUser;
        }>(
          "/api/auth/oauth",
          {
            body: JSON.stringify({ idToken, provider: "google" }),
            method: "POST",
          },
          { auth: false, retry: false }
        );
        persistSession(payload);
        showFlash("Signed in with Google.", "success");
      }
    } catch (error) {
      showFlash(error instanceof Error ? error.message : "OAuth sign-in failed", "error");
    } finally {
      window.localStorage.removeItem(OAUTH_STORAGE_KEY);
      window.history.replaceState({}, "", window.location.pathname);
      setOauthBusy(null);
    }
  }

  async function hydrateSession() {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === "light" || storedTheme === "dark") {
      persistTheme(storedTheme);
    } else {
      persistTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    }

    const rawSession = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (rawSession) {
      try {
        const parsed = JSON.parse(rawSession) as AuthSession;
        persistSession(parsed);
      } catch {
        persistSession(null);
      }
    }

    await completeOauthCallback();
    setIsBooting(false);
  }

  function beginOauth(provider: "github" | "google") {
    if (!oauthConfig) {
      showFlash("OAuth configuration is still loading.", "info");
      return;
    }

    const providerConfig = oauthConfig.providers[provider];
    if (!providerConfig.enabled || !providerConfig.clientId) {
      showFlash(`${provider} sign-in is not configured on this deployment.`, "error");
      return;
    }

    const state = `${provider}:${crypto.randomUUID()}`;
    window.localStorage.setItem(OAUTH_STORAGE_KEY, state);
    setOauthBusy(provider);

    const redirectUri = window.location.origin;
    if (provider === "github") {
      const query = new URLSearchParams({
        client_id: providerConfig.clientId,
        redirect_uri: redirectUri,
        scope: "read:user user:email",
        state,
      });
      window.location.assign(`https://github.com/login/oauth/authorize?${query.toString()}`);
      return;
    }

    const nonce = crypto.randomUUID();
    const query = new URLSearchParams({
      client_id: providerConfig.clientId,
      redirect_uri: redirectUri,
      response_type: "id_token",
      scope: "openid email profile",
      state,
      nonce,
      prompt: "select_account",
    });
    window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${query.toString()}`);
  }

  async function handleAuthSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyKey("auth");

    try {
      const path = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload = await apiFetch<{
        accessToken: string;
        accessTokenExpiresAt: string;
        refreshToken: string;
        user: SessionUser;
      }>(
        path,
        {
          body: JSON.stringify({
            email: authForm.email.trim(),
            password: authForm.password,
            ...(authMode === "register" ? { username: authForm.username.trim() } : {}),
          }),
          method: "POST",
        },
        { auth: false, retry: false }
      );

      persistSession(payload);
      setAuthForm({ email: "", password: "", username: "" });
      showFlash(authMode === "login" ? "Welcome back to SportsDeck." : "Account created and ready to go.", "success");
    } catch (error) {
      showFlash(error instanceof Error ? error.message : "Authentication failed", "error");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleLogout() {
    setBusyKey("logout");
    try {
      if (sessionRef.current?.accessToken) {
        await apiFetch(
          "/api/auth/logout",
          {
            body: JSON.stringify({ refreshToken: sessionRef.current.refreshToken }),
            method: "POST",
          },
          { auth: true }
        );
      }
    } catch (error) {
      console.error(error);
    } finally {
      persistSession(null);
      setSelectedUserId(null);
      showFlash("Signed out cleanly.", "success");
      setBusyKey(null);
    }
  }

  async function handleProfileSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyKey("profile");

    try {
      const payload = await apiFetch<{ user: SessionUser }>(
        "/api/users/me",
        {
          body: JSON.stringify({
            avatarUrl: profileForm.avatarUrl.trim() || null,
            favoriteTeamId: profileForm.favoriteTeamId ? Number(profileForm.favoriteTeamId) : null,
            username: profileForm.username.trim(),
          }),
          method: "PATCH",
        },
        { auth: true }
      );

      persistSession({
        ...sessionRef.current!,
        user: {
          ...sessionRef.current!.user,
          ...payload.user,
        },
      });
      showFlash("Profile updated.", "success");
      await loadPrivateData();
    } catch (error) {
      showFlash(error instanceof Error ? error.message : "Could not update profile", "error");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleCreateThread(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyKey("thread-create");
    try {
      const payload = await apiFetch<{ thread: ThreadSummary }>(
        "/api/threads",
        {
          body: JSON.stringify({
            title: threadComposer.title.trim(),
            body: threadComposer.body.trim(),
            tags: parseTagInput(threadComposer.tags),
            teamId: threadComposer.type === "TEAM" ? Number(threadComposer.teamId) : undefined,
            type: threadComposer.type,
          }),
          method: "POST",
        },
        { auth: true }
      );

      setThreadComposer({
        body: "",
        tags: "",
        teamId: "",
        title: "",
        type: "GENERAL",
      });
      showFlash("Thread published.", "success");
      await loadThreads();
      router.push(`/forums?thread=${payload.thread.id}`);
    } catch (error) {
      showFlash(error instanceof Error ? error.message : "Could not publish thread", "error");
    } finally {
      setBusyKey(null);
    }
  }

  async function handlePromptUpdate(kind: "thread" | "post" | "reply" | "poll", id: number, currentBody: string) {
    const nextBody = window.prompt(`Edit this ${kind}`, currentBody);
    if (!nextBody || !nextBody.trim()) return;

    setBusyKey(`${kind}-edit-${id}`);
    try {
      if (kind === "thread") {
        await apiFetch(
          `/api/threads/${id}`,
          { body: JSON.stringify({ tags: parseTagInput(threadEdit.tags), title: nextBody.trim() }), method: "PATCH" },
          { auth: true }
        );
      } else if (kind === "post") {
        await apiFetch(`/api/posts/${id}`, { body: JSON.stringify({ body: nextBody.trim() }), method: "PATCH" }, { auth: true });
      } else if (kind === "reply") {
        await apiFetch(`/api/replies/${id}`, { body: JSON.stringify({ body: nextBody.trim() }), method: "PATCH" }, { auth: true });
      } else {
        await apiFetch(`/api/polls/${id}`, { body: JSON.stringify({ question: nextBody.trim() }), method: "PATCH" }, { auth: true });
      }

      showFlash(`${kind} updated.`, "success");
      if (selectedThreadId) await Promise.all([loadSelectedThread(selectedThreadId), loadThreads()]);
    } catch (error) {
      showFlash(error instanceof Error ? error.message : `Could not update ${kind}`, "error");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDelete(kind: "thread" | "post" | "reply" | "poll", id: number) {
    if (!window.confirm(`Delete this ${kind}?`)) return;
    setBusyKey(`${kind}-delete-${id}`);
    try {
      const path = kind === "thread" ? "threads" : kind === "post" ? "posts" : kind === "reply" ? "replies" : "polls";
      await apiFetch(`/api/${path}/${id}`, { method: "DELETE" }, { auth: true });
      showFlash(`${kind} deleted.`, "success");
      if (kind === "thread") {
        setSelectedThread(null);
        setSelectedThreadId(null);
      }
      await Promise.all([loadThreads(), selectedThreadId ? loadSelectedThread(selectedThreadId) : Promise.resolve(), loadPrivateData()]);
    } catch (error) {
      showFlash(error instanceof Error ? error.message : `Could not delete ${kind}`, "error");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleCreatePost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedThread) return;
    setBusyKey("post-create");
    try {
      await apiFetch(
        `/api/threads/${selectedThread.id}/posts`,
        {
          body: JSON.stringify({ body: newPostBody.trim() }),
          method: "POST",
        },
        { auth: true }
      );
      setNewPostBody("");
      showFlash("Post added to the thread.", "success");
      await Promise.all([loadSelectedThread(selectedThread.id), loadPrivateData()]);
    } catch (error) {
      showFlash(error instanceof Error ? error.message : "Could not add post", "error");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleCreateReply(postId: number) {
    const body = replyDrafts[postId]?.trim();
    if (!body) return;
    setBusyKey(`reply-create-${postId}`);
    try {
      await apiFetch(
        `/api/posts/${postId}/replies`,
        {
          body: JSON.stringify({ body }),
          method: "POST",
        },
        { auth: true }
      );
      setReplyDrafts((current) => ({ ...current, [postId]: "" }));
      showFlash("Reply posted.", "success");
      if (selectedThreadId) await loadSelectedThread(selectedThreadId);
    } catch (error) {
      showFlash(error instanceof Error ? error.message : "Could not send reply", "error");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleCreatePoll(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedThread) return;
    setBusyKey("poll-create");
    try {
      await apiFetch(
        `/api/threads/${selectedThread.id}/polls`,
        {
          body: JSON.stringify({
            deadline: pollComposer.deadline,
            options: pollComposer.options.split("\n").map((option) => option.trim()).filter(Boolean),
            question: pollComposer.question.trim(),
          }),
          method: "POST",
        },
        { auth: true }
      );
      setPollComposer({ deadline: "", options: "", question: "" });
      showFlash("Poll created.", "success");
      await loadSelectedThread(selectedThread.id);
    } catch (error) {
      showFlash(error instanceof Error ? error.message : "Could not create poll", "error");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleVote(pollId: number, optionId: number) {
    setBusyKey(`vote-${pollId}-${optionId}`);
    try {
      await apiFetch(
        `/api/polls/${pollId}/votes`,
        { body: JSON.stringify({ optionId }), method: "POST" },
        { auth: true }
      );
      showFlash("Vote recorded.", "success");
      if (selectedThreadId) await loadSelectedThread(selectedThreadId);
    } catch (error) {
      showFlash(error instanceof Error ? error.message : "Could not vote", "error");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleTranslate(key: string, text: string) {
    setBusyKey(`translate-${key}`);
    try {
      const payload = await apiFetch<{ translatedText: string }>(
        "/api/ai/translate",
        {
          body: JSON.stringify({ source: "Auto Detect", target: "English", text }),
          method: "POST",
        },
        { auth: true }
      );
      setTranslations((current) => ({ ...current, [key]: payload.translatedText }));
      showFlash("Translation ready.", "success");
    } catch (error) {
      showFlash(error instanceof Error ? error.message : "Could not translate text", "error");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleReport(target: { postId?: number; replyId?: number; threadId?: number }) {
    const reason = window.prompt("Why are you reporting this content?");
    if (!reason?.trim()) return;

    setBusyKey("report");
    try {
      await apiFetch(
        "/api/reports",
        {
          body: JSON.stringify({
            reason: reason.trim(),
            ...(target.threadId ? { threadId: target.threadId } : {}),
            ...(target.postId ? { postId: target.postId } : {}),
            ...(target.replyId ? { replyId: target.replyId } : {}),
          }),
          method: "POST",
        },
        { auth: true }
      );
      showFlash("Report sent to moderation.", "success");
    } catch (error) {
      showFlash(error instanceof Error ? error.message : "Could not submit report", "error");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleRevisions(kind: "post" | "reply", id: number) {
    setBusyKey(`revisions-${kind}-${id}`);
    try {
      const payload = await apiFetch<RevisionPayload>(`/api/${kind === "post" ? "posts" : "replies"}/${id}/revisions`, undefined, {
        auth: false,
        retry: false,
      });
      setRevisionViewer({ id, items: payload.revisions, kind });
    } catch (error) {
      showFlash(error instanceof Error ? error.message : "Could not load revisions", "error");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleToggleFollow() {
    if (!selectedUserId || !currentUser || selectedUserId === currentUser.id) return;
    setBusyKey("follow-toggle");
    try {
      await apiFetch(`/api/users/${selectedUserId}/follow`, { method: selectedUserIsFollowed ? "DELETE" : "POST" }, { auth: true });
      showFlash(selectedUserIsFollowed ? "Unfollowed user." : "Now following user.", "success");
      await Promise.all([loadPrivateData(), loadSelectedUser(selectedUserId)]);
    } catch (error) {
      showFlash(error instanceof Error ? error.message : "Could not update follow state", "error");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleRemoveFollower(followerId: number) {
    setBusyKey(`remove-follower-${followerId}`);
    try {
      await apiFetch(`/api/users/me/followers/${followerId}`, { method: "DELETE" }, { auth: true });
      showFlash("Follower removed.", "success");
      await loadPrivateData();
    } catch (error) {
      showFlash(error instanceof Error ? error.message : "Could not remove follower", "error");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleGenerateDigest() {
    setBusyKey("digest-generate");
    try {
      const payload = await apiFetch<DigestThread>("/api/ai/digest", { method: "POST" }, { auth: true });
      setDigest(payload);
      showFlash("Daily digest is live.", "success");
    } catch (error) {
      showFlash(error instanceof Error ? error.message : "Could not generate digest", "error");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleAppealSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyKey("appeal");
    try {
      await apiFetch(
        "/api/appeals",
        {
          body: JSON.stringify({ message: appealMessage.trim() }),
          method: "POST",
        },
        { auth: true }
      );
      setAppealMessage("");
      showFlash("Appeal submitted for review.", "success");
    } catch (error) {
      showFlash(error instanceof Error ? error.message : "Could not submit appeal", "error");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleResolveReport(item: ReportQueueItem, action: "APPROVE" | "DISMISS", banUser = false) {
    const reportId = item.reports[0]?.id;
    if (!reportId) return;

    setBusyKey(`report-${action}-${reportId}`);
    try {
      await apiFetch(
        `/api/admin/reports/${reportId}/resolve`,
        {
          body: JSON.stringify({ action, banUser, note: moderationNote[`report-${reportId}`] ?? "" }),
          method: "POST",
        },
        { auth: true }
      );
      showFlash(action === "APPROVE" ? "Reported content actioned." : "Report dismissed.", "success");
      await loadPrivateData();
      if (selectedThreadId) await loadSelectedThread(selectedThreadId);
    } catch (error) {
      showFlash(error instanceof Error ? error.message : "Could not resolve report", "error");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleResolveAppeal(appealId: number, action: "APPROVE" | "REJECT") {
    setBusyKey(`appeal-${action}-${appealId}`);
    try {
      await apiFetch(
        `/api/admin/appeals/${appealId}/resolve`,
        { body: JSON.stringify({ action }), method: "POST" },
        { auth: true }
      );
      showFlash(action === "APPROVE" ? "Appeal approved." : "Appeal rejected.", "success");
      await loadPrivateData();
    } catch (error) {
      showFlash(error instanceof Error ? error.message : "Could not resolve appeal", "error");
    } finally {
      setBusyKey(null);
    }
  }

  async function openMatchThread(matchId: number) {
    setBusyKey(`match-thread-${matchId}`);
    try {
      const payload = await apiFetch<ThreadsPayload>(`/api/threads?matchId=${matchId}&limit=1`, undefined, {
        auth: false,
        retry: false,
      });
      const thread = payload.threads[0];
      if (!thread) {
        showFlash("That match thread is not open yet.", "info");
        return;
      }
      router.push(`/forums?thread=${thread.id}`);
    } catch (error) {
      showFlash(error instanceof Error ? error.message : "Could not open match thread", "error");
    } finally {
      setBusyKey(null);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setFlash(null), flash ? 3500 : 0);
    return () => window.clearTimeout(timer);
  }, [flash]);

  useEffect(() => {
    void hydrateSession();
    void loadPublicData();
  }, []);

  useEffect(() => {
    if (!isBooting) void loadMatches();
  }, [isBooting, matchWindow, matchdayFilter, stageFilter]);

  useEffect(() => {
    if (!isBooting) void loadThreads();
  }, [isBooting, deferredThreadAuthor, deferredThreadQuery, deferredThreadTag, threadTeamFilter, threadTypeFilter]);

  useEffect(() => {
    if (showForums && threadQueryParam) {
      const parsed = Number(threadQueryParam);
      if (Number.isInteger(parsed) && parsed > 0 && parsed !== selectedThreadId) {
        setSelectedThreadId(parsed);
      }
    }
  }, [selectedThreadId, showForums, threadQueryParam]);

  useEffect(() => {
    if (selectedThreadId) void loadSelectedThread(selectedThreadId);
  }, [selectedThreadId]);

  useEffect(() => {
    if (showCommunity && userQueryParam) {
      const parsed = Number(userQueryParam);
      if (Number.isInteger(parsed) && parsed > 0 && parsed !== selectedUserId) {
        setSelectedUserId(parsed);
      }
    }
  }, [selectedUserId, showCommunity, userQueryParam]);

  useEffect(() => {
    if (selectedUserId) void loadSelectedUser(selectedUserId);
  }, [selectedUserId]);

  useEffect(() => {
    if (!isBooting) {
      if (session) {
        void loadPrivateData();
      } else {
        setFeed(null);
        setFollowing([]);
        setFollowers([]);
        setReportsQueue([]);
        setAppeals([]);
      }
    }
  }, [isBooting, session]);

  const navItems = [
    { href: "/", label: "Overview", active: showOverview },
    { href: "/matches", label: "Matches", active: showMatches },
    { href: "/forums", label: "Forums", active: showForums },
    { href: "/community", label: "Community", active: showCommunity },
    { href: "/account", label: currentUser ? "My Desk" : "Accounts", active: showAccount },
    ...(currentUser?.role === "ADMIN" ? [{ href: "/admin", label: "Moderation", active: showAdmin }] : []),
  ] satisfies Array<{ active: boolean; href: string; label: string }>;

  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--text)]">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-4 sm:px-6 lg:px-8">
        <header className="sticky top-4 z-30 mb-6 rounded-[28px] border border-white/10 bg-[color:var(--header)] px-4 py-4 shadow-[0_24px_80px_-50px_rgba(8,17,29,0.75)] backdrop-blur-2xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--accent),var(--accent-2))] text-lg font-black tracking-[0.18em] text-white">
                SD
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/55">SportsDeck</p>
                <p className="text-sm text-white/80">Single-page league HQ for matchdays, fan takes, and moderation.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {navItems.map(({ href, label, active }) => (
                <Link
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm transition",
                    active
                      ? "border-white/20 bg-white text-slate-950"
                      : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white"
                  )}
                  href={href}
                  key={href}
                >
                  {label}
                </Link>
              ))}
              <button
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
                onClick={() => persistTheme(theme === "dark" ? "light" : "dark")}
                type="button"
              >
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </button>
              {currentUser ? (
                <button
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:opacity-90"
                  disabled={busyKey === "logout"}
                  onClick={handleLogout}
                  type="button"
                >
                  {busyKey === "logout" ? "Signing out..." : `Sign out ${currentUser.username}`}
                </button>
              ) : (
                <Link
                  className="rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                  href="/account"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </header>

        {showOverview ? (
        <section className="grid gap-6 lg:grid-cols-[1.35fr_0.95fr]">
          <Panel className="relative overflow-hidden border-white/10 bg-[linear-gradient(135deg,rgba(8,17,29,0.94),rgba(10,38,50,0.88))] px-6 py-7 text-white sm:px-8 sm:py-8">
            <div
              aria-hidden
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), url('https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1400&q=80')",
                backgroundPosition: "center",
                backgroundSize: "120px 120px, 120px 120px, cover",
              }}
            />
            <div className="relative max-w-3xl">
              <p className="inline-flex rounded-full border border-white/15 bg-white/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.32em] text-white/70">
                Sporting vibe first
              </p>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                Matchdays, forums, AI summaries, and moderation in one fluid fan hub.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-white/75 sm:text-lg">
                Public league browsing stays front and center, while JWT auth, discussion tools, social activity, and moderation actions stay accessible without leaving the page.
              </p>
            </div>
          </Panel>

          <div className="grid gap-6">
            <Panel className="overflow-hidden bg-[linear-gradient(135deg,rgba(255,112,68,0.18),rgba(17,206,168,0.14))]">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[color:var(--muted)]">Matchday spotlight</p>
              {heroMatch ? (
                <>
                  <h3 className="mt-3 text-2xl font-semibold text-[color:var(--text)]">
                    {(heroMatch.homeTeam.shortName ?? heroMatch.homeTeam.name)} vs {heroMatch.awayTeam.shortName ?? heroMatch.awayTeam.name}
                  </h3>
                  <p className="mt-2 text-sm text-[color:var(--muted)]">
                    {formatShortDate(heroMatch.utcDate)} at {heroMatch.venue ?? "venue TBA"}
                  </p>
                  <button
                    className="mt-4 rounded-full bg-[color:var(--text)] px-4 py-2 text-sm font-semibold text-[color:var(--bg)] transition hover:opacity-90"
                    disabled={busyKey === `match-thread-${heroMatch.id}`}
                    onClick={() => openMatchThread(heroMatch.id)}
                    type="button"
                  >
                    Open match thread
                  </button>
                </>
              ) : (
                <p className="mt-3 text-sm text-[color:var(--muted)]">Loading the next featured fixture.</p>
              )}
            </Panel>

            <Panel>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[color:var(--muted)]">League pulse</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {[
                  [`${teams.length}`, "teams"],
                  [`${threadsPayload?.total ?? "--"}`, "threads"],
                  [standings?.snapshot.season ?? "--", "season"],
                ].map(([value, label]) => (
                  <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--soft)] p-4" key={label}>
                    <p className="text-3xl font-semibold">{value}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.3em] text-[color:var(--muted)]">{label}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </section>
        ) : null}

        {showMatches ? (
        <section className="mt-10">
          <SectionTitle
            description="Browse upcoming and recent fixtures, switch matchdays and stages without leaving the page, and keep the standings nearby so context is always visible."
            eyebrow="Match Centre"
            title="Fixtures and table, tuned for quick scanning"
          />
          <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
            <Panel>
              <div className="flex flex-wrap gap-2">
                {(["upcoming", "recent", "all"] as const).map((windowValue) => (
                  <button
                    className={cn(
                      "rounded-full px-4 py-2 text-sm font-semibold transition",
                      matchWindow === windowValue
                        ? "bg-[color:var(--text)] text-[color:var(--bg)]"
                        : "border border-[color:var(--border)] text-[color:var(--muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                    )}
                    key={windowValue}
                    onClick={() => setMatchWindow(windowValue)}
                    type="button"
                  >
                    {windowValue}
                  </button>
                ))}
                <select className="rounded-full border border-[color:var(--border)] bg-transparent px-4 py-2 text-sm" onChange={(event) => setMatchdayFilter(event.target.value)} value={matchdayFilter}>
                  <option value="all">All matchdays</option>
                  {matchesPayload?.filters.available.matchdays.map((matchday) => (
                    <option key={matchday} value={matchday}>
                      Matchday {matchday}
                    </option>
                  ))}
                </select>
                <select className="rounded-full border border-[color:var(--border)] bg-transparent px-4 py-2 text-sm" onChange={(event) => setStageFilter(event.target.value)} value={stageFilter}>
                  <option value="all">All stages</option>
                  {matchesPayload?.filters.available.stages.map((stage) => (
                    <option key={stage} value={stage}>
                      {stage}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-6 grid gap-4">
                {matchesLoading ? <div className="text-sm text-[color:var(--muted)]">Pulling the latest fixtures...</div> : null}
                {matchesPayload?.matches.map((match) => (
                  <button
                    className="grid gap-4 rounded-[26px] border border-[color:var(--border)] bg-[color:var(--soft)] px-4 py-4 text-left transition hover:border-[color:var(--accent)]"
                    key={match.id}
                    onClick={() => openMatchThread(match.id)}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-[color:var(--text)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-[color:var(--bg)]">
                        {match.status}
                      </span>
                      <span className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">{formatShortDate(match.utcDate)}</span>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                      <div className="flex items-center gap-3">
                        <Avatar image={match.homeTeam.crestUrl} label={match.homeTeam.name} />
                        <span className="font-semibold">{match.homeTeam.shortName ?? match.homeTeam.name}</span>
                      </div>
                      <div className="text-center text-2xl font-semibold">
                        {match.homeTeam.score ?? "-"} : {match.awayTeam.score ?? "-"}
                      </div>
                      <div className="flex items-center justify-start gap-3 sm:justify-end">
                        <span className="font-semibold">{match.awayTeam.shortName ?? match.awayTeam.name}</span>
                        <Avatar image={match.awayTeam.crestUrl} label={match.awayTeam.name} />
                      </div>
                    </div>
                    <p className="text-sm text-[color:var(--muted)]">{match.venue ?? "Venue TBA"}</p>
                  </button>
                ))}
              </div>
            </Panel>

            <Panel>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted)]">{extractCompetitionName(standings)}</p>
              <h3 className="mt-3 text-2xl font-semibold">{standings?.snapshot.season ?? "Current season"} table</h3>
              <p className="mt-2 text-sm text-[color:var(--muted)]">Updated {formatShortDate(standings?.snapshot.fetchedAt)}</p>
              <div className="mt-5 overflow-hidden rounded-[24px] border border-[color:var(--border)]">
                <div className="grid grid-cols-[44px_1.6fr_40px_40px_40px_54px] gap-2 bg-[color:var(--soft)] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-[color:var(--muted)]">
                  <span>#</span>
                  <span>Team</span>
                  <span>P</span>
                  <span>W</span>
                  <span>D</span>
                  <span>Pts</span>
                </div>
                <div className="divide-y divide-[color:var(--border)]">
                  {standingsRows.slice(0, 10).map((row) => (
                    <div className="grid grid-cols-[44px_1.6fr_40px_40px_40px_54px] items-center gap-2 px-4 py-3 text-sm" key={`${row.team}-${row.position}`}>
                      <span className="font-semibold">{row.position ?? "-"}</span>
                      <span className="flex items-center gap-3">
                        {row.crestUrl ? <img alt={row.team} className="h-7 w-7 object-contain" loading="lazy" src={row.crestUrl} /> : null}
                        <span className="truncate font-medium">{row.team}</span>
                      </span>
                      <span>{row.played ?? "-"}</span>
                      <span>{row.won ?? "-"}</span>
                      <span>{row.draw ?? "-"}</span>
                      <span className="font-semibold">{row.points ?? "-"}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {featuredTeams.map((team) => (
                  <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--soft)] px-3 py-3" key={team.id}>
                    <Avatar image={team.crestUrl} label={team.name} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{team.shortName ?? team.name}</p>
                      <p className="truncate text-xs text-[color:var(--muted)]">{team.venue ?? "Stadium TBA"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </section>
        ) : null}

        {showForums ? (
        <section className="mt-10">
          <SectionTitle
            description="Search general, team, and match threads in place, then read, write, edit, vote, translate, report, and moderate without navigating away."
            eyebrow="Forums and Discussions"
            title="Dedicated threads, match sentiment, replies, polls, and history"
          />
          <div className="mt-6 grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
            <div className="grid gap-6">
              <Panel>
                <div className="grid gap-3">
                  <input className="rounded-[22px] border border-[color:var(--border)] bg-transparent px-4 py-3 text-sm" onChange={(event) => setThreadQuery(event.target.value)} placeholder="Search thread titles" value={threadQuery} />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <input className="rounded-[22px] border border-[color:var(--border)] bg-transparent px-4 py-3 text-sm" onChange={(event) => setThreadAuthorFilter(event.target.value)} placeholder="Author" value={threadAuthorFilter} />
                    <input className="rounded-[22px] border border-[color:var(--border)] bg-transparent px-4 py-3 text-sm" onChange={(event) => setThreadTagFilter(event.target.value)} placeholder="Tags" value={threadTagFilter} />
                    <select className="rounded-[22px] border border-[color:var(--border)] bg-transparent px-4 py-3 text-sm" onChange={(event) => setThreadTypeFilter(event.target.value as ThreadType)} value={threadTypeFilter}>
                      <option value="ALL">All types</option>
                      <option value="GENERAL">General</option>
                      <option value="TEAM">Team</option>
                      <option value="MATCH">Match</option>
                    </select>
                  </div>
                  <select className="rounded-[22px] border border-[color:var(--border)] bg-transparent px-4 py-3 text-sm" onChange={(event) => setThreadTeamFilter(event.target.value)} value={threadTeamFilter}>
                    <option value="all">All teams</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-5 grid gap-3">
                  {threadsLoading ? <div className="text-sm text-[color:var(--muted)]">Refreshing threads...</div> : null}
                  {threadsPayload?.threads.map((thread) => (
                    <button
                      className={cn(
                        "rounded-[24px] border px-4 py-4 text-left transition",
                        selectedThreadId === thread.id
                          ? "border-[color:var(--accent)] bg-[linear-gradient(135deg,rgba(255,106,61,0.14),rgba(17,206,168,0.08))]"
                          : "border-[color:var(--border)] bg-[color:var(--soft)] hover:border-[color:var(--accent)]"
                      )}
                      key={thread.id}
                      onClick={() => startTransition(() => setSelectedThreadId(thread.id))}
                      type="button"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[color:var(--text)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-[color:var(--bg)]">{thread.type}</span>
                        <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">{thread.isOpenForPosting ? "open" : "locked"}</span>
                      </div>
                      <h3 className="mt-3 text-lg font-semibold">{thread.title}</h3>
                      <p className="mt-2 text-sm text-[color:var(--muted)]">
                        {thread.author?.username ? `by ${thread.author.username}` : "Auto-generated"} · {thread._count.posts} posts · {thread._count.polls} polls
                      </p>
                    </button>
                  ))}
                </div>
              </Panel>

              <Panel>
                <SectionTitle eyebrow="Start A Thread" title="Create discussion prompts fans can find" description="Users can open a general thread or a team forum topic with tags. Match threads stay auto-managed from the backend." />
                {currentUser ? (
                  <form className="mt-5 grid gap-3" onSubmit={handleCreateThread}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <select className="rounded-[22px] border border-[color:var(--border)] bg-transparent px-4 py-3 text-sm" onChange={(event) => setThreadComposer((current) => ({ ...current, type: event.target.value as "GENERAL" | "TEAM" }))} value={threadComposer.type}>
                        <option value="GENERAL">General forum</option>
                        <option value="TEAM">Team forum</option>
                      </select>
                      <select className="rounded-[22px] border border-[color:var(--border)] bg-transparent px-4 py-3 text-sm" disabled={threadComposer.type !== "TEAM"} onChange={(event) => setThreadComposer((current) => ({ ...current, teamId: event.target.value }))} value={threadComposer.teamId}>
                        <option value="">Choose a team</option>
                        {teams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <input className="rounded-[22px] border border-[color:var(--border)] bg-transparent px-4 py-3 text-sm" onChange={(event) => setThreadComposer((current) => ({ ...current, title: event.target.value }))} placeholder="Thread title" value={threadComposer.title} />
                    <input className="rounded-[22px] border border-[color:var(--border)] bg-transparent px-4 py-3 text-sm" onChange={(event) => setThreadComposer((current) => ({ ...current, tags: event.target.value }))} placeholder="Tags, comma separated" value={threadComposer.tags} />
                    <textarea className="min-h-36 rounded-[22px] border border-[color:var(--border)] bg-transparent px-4 py-3 text-sm" onChange={(event) => setThreadComposer((current) => ({ ...current, body: event.target.value }))} placeholder="Write the opening post" value={threadComposer.body} />
                    <button className="rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white" disabled={busyKey === "thread-create"} type="submit">
                      {busyKey === "thread-create" ? "Publishing..." : "Publish thread"}
                    </button>
                  </form>
                ) : (
                  <div className="mt-5 rounded-[22px] border border-dashed border-[color:var(--border)] px-5 py-6 text-sm text-[color:var(--muted)]">Sign in to create threads, add posts, vote in polls, and file moderation reports.</div>
                )}
              </Panel>
            </div>

            <Panel className="min-h-[500px]">
              {threadDetailLoading ? (
                <div className="text-sm text-[color:var(--muted)]">Opening thread...</div>
              ) : selectedThread ? (
                <>
                  <div className="border-b border-[color:var(--border)] pb-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[color:var(--text)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-[color:var(--bg)]">{selectedThread.type}</span>
                      {selectedThread.tags.map((tag) => (
                        <span className="rounded-full border border-[color:var(--border)] px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-[color:var(--muted)]" key={tag}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                    <h3 className="mt-4 text-3xl font-semibold tracking-tight">{selectedThread.title}</h3>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[color:var(--muted)]">
                      {selectedThread.author ? (
                        <button className="font-semibold text-[color:var(--text)] transition hover:text-[color:var(--accent)]" onClick={() => router.push(`/community?user=${selectedThread.author!.id}`)} type="button">
                          {selectedThread.author.username}
                        </button>
                      ) : (
                        <span>Auto-generated thread</span>
                      )}
                      <span>Updated {formatShortDate(selectedThread.updatedAt)}</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {currentUser?.id === selectedThread.authorId ? (
                        <>
                          <button className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-semibold" onClick={() => handlePromptUpdate("thread", selectedThread.id, selectedThread.title)} type="button">Edit thread</button>
                          <button className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-semibold" onClick={() => handleDelete("thread", selectedThread.id)} type="button">Delete thread</button>
                        </>
                      ) : null}
                      <button className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-semibold" onClick={() => handleReport({ threadId: selectedThread.id })} type="button">Report thread</button>
                    </div>
                  </div>

                  {selectedThread.match ? (
                    <div className="mt-5 rounded-[24px] border border-[color:var(--border)] bg-[linear-gradient(135deg,rgba(12,140,234,0.12),rgba(255,106,61,0.08))] p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <Avatar image={selectedThread.match.homeTeam.crestUrl} label={selectedThread.match.homeTeam.name} />
                          <div className="text-center">
                            <p className="text-3xl font-semibold">{selectedThread.match.scoreHome ?? "-"} : {selectedThread.match.scoreAway ?? "-"}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">{selectedThread.match.status}</p>
                          </div>
                          <Avatar image={selectedThread.match.awayTeam.crestUrl} label={selectedThread.match.awayTeam.name} />
                        </div>
                        <div className="text-sm text-[color:var(--muted)]">{formatShortDate(selectedThread.match.utcDate)}</div>
                      </div>
                      {selectedSentiment ? (
                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          <div className="rounded-[20px] bg-[color:var(--header)] p-4 text-white">
                            <p className="text-xs uppercase tracking-[0.3em] text-white/55">Overall mood</p>
                            <p className={cn("mt-3 text-2xl font-semibold capitalize", moodTone(selectedSentiment.overall))}>{selectedSentiment.overall}</p>
                            <p className="mt-2 text-sm text-white/70">{selectedSentiment.commentCount} comments analyzed</p>
                          </div>
                          <div className="rounded-[20px] border border-[color:var(--border)] bg-white/55 p-4">
                            <p className="text-sm font-semibold capitalize">{selectedSentiment.homeTeam}</p>
                            <p className="mt-2 text-sm text-[color:var(--muted)]">{selectedSentiment.homeFanCommentCount} home-fan comments</p>
                          </div>
                          <div className="rounded-[20px] border border-[color:var(--border)] bg-white/55 p-4">
                            <p className="text-sm font-semibold capitalize">{selectedSentiment.awayTeam}</p>
                            <p className="mt-2 text-sm text-[color:var(--muted)]">{selectedSentiment.awayFanCommentCount} away-fan comments</p>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {selectedThread.polls.length ? (
                    <div className="mt-5 grid gap-4">
                      {selectedThread.polls.map((poll) => (
                        <div className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--soft)] p-4" key={poll.id}>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <h4 className="text-xl font-semibold">{poll.question}</h4>
                              <p className="mt-2 text-sm text-[color:var(--muted)]">Deadline {formatShortDate(poll.deadline)} · {poll.totalVotes} votes</p>
                            </div>
                            {currentUser?.id === poll.authorId ? (
                              <div className="flex gap-2">
                                <button className="rounded-full border border-[color:var(--border)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em]" onClick={() => handlePromptUpdate("poll", poll.id, poll.question)} type="button">Edit</button>
                                <button className="rounded-full border border-[color:var(--border)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em]" onClick={() => handleDelete("poll", poll.id)} type="button">Delete</button>
                              </div>
                            ) : null}
                          </div>
                          <div className="mt-4 grid gap-3">
                            {poll.options.map((option) => (
                              <button className="rounded-[20px] border border-[color:var(--border)] bg-white/65 px-4 py-3 text-left transition hover:border-[color:var(--accent)] disabled:cursor-not-allowed" disabled={!poll.isVotingOpen || busyKey === `vote-${poll.id}-${option.id}`} key={option.id} onClick={() => handleVote(poll.id, option.id)} type="button">
                                <div className="flex items-center justify-between gap-4">
                                  <span className="font-medium">{option.text}</span>
                                  <span className="text-sm text-[color:var(--muted)]">{option.votes} votes</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {currentUser && selectedThread.isOpenForPosting ? (
                    <form className="mt-5 grid gap-3 rounded-[24px] border border-[color:var(--border)] bg-[color:var(--soft)] p-4" onSubmit={handleCreatePoll}>
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted)]">Create a poll</p>
                      <input className="rounded-[18px] border border-[color:var(--border)] bg-transparent px-4 py-3 text-sm" onChange={(event) => setPollComposer((current) => ({ ...current, question: event.target.value }))} placeholder="Question" value={pollComposer.question} />
                      <input className="rounded-[18px] border border-[color:var(--border)] bg-transparent px-4 py-3 text-sm" onChange={(event) => setPollComposer((current) => ({ ...current, deadline: event.target.value }))} type="datetime-local" value={pollComposer.deadline} />
                      <textarea className="min-h-24 rounded-[18px] border border-[color:var(--border)] bg-transparent px-4 py-3 text-sm" onChange={(event) => setPollComposer((current) => ({ ...current, options: event.target.value }))} placeholder={"One option per line\nHome win\nDraw\nAway win"} value={pollComposer.options} />
                      <button className="rounded-full bg-[color:var(--text)] px-4 py-3 text-sm font-semibold text-[color:var(--bg)]" disabled={busyKey === "poll-create"} type="submit">Create poll</button>
                    </form>
                  ) : null}

                  <div className="mt-5 grid gap-4">
                    {selectedThread.posts.map((post) => (
                      <div className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--soft)] p-4" key={post.id}>
                        <div className="flex items-start gap-4">
                          <button className="shrink-0" onClick={() => router.push(`/community?user=${post.author.id}`)} type="button">
                            <Avatar image={post.author.avatarUrl} label={post.author.username} />
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <button className="font-semibold transition hover:text-[color:var(--accent)]" onClick={() => router.push(`/community?user=${post.author.id}`)} type="button">
                                {post.author.username}
                              </button>
                              <span className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">{formatShortDate(post.createdAt)}</span>
                            </div>
                            <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{post.body}</p>
                            {translations[`post-${post.id}`] ? <p className="mt-3 rounded-[18px] border border-[color:var(--border)] bg-white/60 px-4 py-3 text-sm text-[color:var(--muted)]">{translations[`post-${post.id}`]}</p> : null}
                            <div className="mt-4 flex flex-wrap gap-2">
                              <button className="rounded-full border border-[color:var(--border)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em]" onClick={() => handleTranslate(`post-${post.id}`, post.body)} type="button">Translate</button>
                              <button className="rounded-full border border-[color:var(--border)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em]" onClick={() => handleRevisions("post", post.id)} type="button">History</button>
                              <button className="rounded-full border border-[color:var(--border)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em]" onClick={() => handleReport({ postId: post.id })} type="button">Report</button>
                              {currentUser?.id === post.authorId ? (
                                <>
                                  <button className="rounded-full border border-[color:var(--border)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em]" onClick={() => handlePromptUpdate("post", post.id, post.body)} type="button">Edit</button>
                                  <button className="rounded-full border border-[color:var(--border)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em]" onClick={() => handleDelete("post", post.id)} type="button">Delete</button>
                                </>
                              ) : null}
                            </div>
                            <div className="mt-4 grid gap-3">
                              {post.replies.map((reply) => (
                                <div className="rounded-[20px] border border-[color:var(--border)] bg-white/60 p-4" key={reply.id}>
                                  <div className="flex items-start gap-3">
                                    <button className="shrink-0" onClick={() => router.push(`/community?user=${reply.author.id}`)} type="button">
                                      <Avatar image={reply.author.avatarUrl} label={reply.author.username} size="sm" />
                                    </button>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <button className="font-semibold transition hover:text-[color:var(--accent)]" onClick={() => router.push(`/community?user=${reply.author.id}`)} type="button">
                                          {reply.author.username}
                                        </button>
                                        <span className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">{formatShortDate(reply.createdAt)}</span>
                                      </div>
                                      <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{reply.body}</p>
                                      {translations[`reply-${reply.id}`] ? <p className="mt-3 rounded-[18px] border border-[color:var(--border)] bg-[color:var(--soft)] px-4 py-3 text-sm text-[color:var(--muted)]">{translations[`reply-${reply.id}`]}</p> : null}
                                      <div className="mt-4 flex flex-wrap gap-2">
                                        <button className="rounded-full border border-[color:var(--border)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em]" onClick={() => handleTranslate(`reply-${reply.id}`, reply.body)} type="button">Translate</button>
                                        <button className="rounded-full border border-[color:var(--border)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em]" onClick={() => handleRevisions("reply", reply.id)} type="button">History</button>
                                        <button className="rounded-full border border-[color:var(--border)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em]" onClick={() => handleReport({ replyId: reply.id })} type="button">Report</button>
                                        {currentUser?.id === reply.authorId ? (
                                          <>
                                            <button className="rounded-full border border-[color:var(--border)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em]" onClick={() => handlePromptUpdate("reply", reply.id, reply.body)} type="button">Edit</button>
                                            <button className="rounded-full border border-[color:var(--border)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em]" onClick={() => handleDelete("reply", reply.id)} type="button">Delete</button>
                                          </>
                                        ) : null}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                            {currentUser && selectedThread.isOpenForPosting ? (
                              <div className="mt-4 rounded-[20px] border border-[color:var(--border)] bg-white/60 p-4">
                                <textarea className="min-h-24 w-full rounded-[18px] border border-[color:var(--border)] bg-transparent px-4 py-3 text-sm" onChange={(event) => setReplyDrafts((current) => ({ ...current, [post.id]: event.target.value }))} placeholder="Reply to this post" value={replyDrafts[post.id] ?? ""} />
                                <div className="mt-3 flex justify-end">
                                  <button className="rounded-full bg-[color:var(--text)] px-4 py-2 text-sm font-semibold text-[color:var(--bg)]" disabled={busyKey === `reply-create-${post.id}`} onClick={() => handleCreateReply(post.id)} type="button">Post reply</button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {currentUser && selectedThread.isOpenForPosting ? (
                    <form className="mt-5 grid gap-3 rounded-[24px] border border-[color:var(--border)] bg-[linear-gradient(135deg,rgba(255,106,61,0.08),rgba(17,206,168,0.06))] p-4" onSubmit={handleCreatePost}>
                      <textarea className="min-h-32 rounded-[18px] border border-[color:var(--border)] bg-transparent px-4 py-3 text-sm" onChange={(event) => setNewPostBody(event.target.value)} placeholder="Share your take, prediction, or breakdown" value={newPostBody} />
                      <button className="rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white" disabled={busyKey === "post-create"} type="submit">Publish post</button>
                    </form>
                  ) : null}
                </>
              ) : (
                <div className="text-sm text-[color:var(--muted)]">Pick a thread from the list to open the full discussion.</div>
              )}
            </Panel>
          </div>
        </section>
        ) : null}

        {showCommunity ? (
        <section className="mt-10">
          <SectionTitle eyebrow="Community and AI" title="Profiles, follows, digest, and grouped activity" description="Profiles, follower relationships, activity charts, grouped feed events, and the AI daily digest all live together so users can catch up without context switching." />
          <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="grid gap-6">
              <Panel>
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted)]">AI digest</p>
                    <h3 className="mt-3 text-3xl font-semibold">Daily catch-up for busy supporters</h3>
                  </div>
                  {currentUser ? <button className="rounded-full bg-[color:var(--text)] px-5 py-3 text-sm font-semibold text-[color:var(--bg)]" disabled={busyKey === "digest-generate"} onClick={handleGenerateDigest} type="button">{busyKey === "digest-generate" ? "Generating..." : "Generate today's digest"}</button> : null}
                </div>
                <div className="mt-5 rounded-[24px] border border-[color:var(--border)] bg-[color:var(--soft)] p-5">
                  {digest ? (
                    <>
                      <h4 className="text-2xl font-semibold">{digest.title}</h4>
                      <p className="mt-2 text-sm text-[color:var(--muted)]">{digest.posts[0]?.createdAt ? formatShortDate(digest.posts[0].createdAt) : "Ready when available"}</p>
                      <p className="mt-4 whitespace-pre-wrap text-sm leading-8">{digest.posts[0]?.body ?? "Digest text will appear here once generated."}</p>
                    </>
                  ) : (
                    <p className="text-sm text-[color:var(--muted)]">No digest has been generated for today yet.</p>
                  )}
                </div>
              </Panel>

              <Panel>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted)]">Activity feed</p>
                <div className="mt-5 grid gap-3">
                  {feed?.items.length ? (
                    feed.items.map((item) => (
                      <div className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--soft)] p-4" key={item.id}>
                        <div className="flex items-start gap-3">
                          <div className="flex -space-x-3">
                            {item.actors.slice(0, 3).map((actor) => (
                              <button className="ring-2 ring-[color:var(--panel)]" key={actor.id} onClick={() => router.push(`/community?user=${actor.id}`)} type="button">
                                <Avatar image={actor.avatarUrl} label={actor.username} size="sm" />
                              </button>
                            ))}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold">{item.summary}</p>
                            <p className="mt-2 text-xs uppercase tracking-[0.25em] text-[color:var(--muted)]">{formatShortDate(item.latestAt)} · {item.count} grouped events</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-[color:var(--muted)]">{currentUser ? "Your feed is quiet right now." : "Sign in to get a personalized feed."}</div>
                  )}
                </div>
              </Panel>
            </div>

            <div className="grid gap-6">
              <Panel>
                <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                  <div className="flex items-start gap-4">
                    <Avatar image={selectedUserProfile?.user.avatarUrl ?? (selectedUserId && currentUser?.id === selectedUserId ? currentUser.avatarUrl : null)} label={selectedUserProfile?.user.username ?? currentUser?.username ?? "Fan"} size="lg" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted)]">User profile</p>
                      <h3 className="mt-2 text-3xl font-semibold">{selectedUserProfile?.user.username ?? currentUser?.username ?? "Pick a fan from the forum"}</h3>
                      <p className="mt-2 text-sm text-[color:var(--muted)]">{selectedUserProfile ? `Joined ${formatJoinedDate(selectedUserProfile.user.createdAt)}` : "Click usernames across the page to inspect their activity."}</p>
                    </div>
                  </div>
                  {selectedUserProfile && currentUser && selectedUserProfile.user.id !== currentUser.id ? <button className="rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white" disabled={busyKey === "follow-toggle"} onClick={handleToggleFollow} type="button">{selectedUserIsFollowed ? "Unfollow" : "Follow"}</button> : null}
                </div>
                {selectedUserProfile ? (
                  <>
                    <div className="mt-6 grid gap-3 sm:grid-cols-4">
                      {[
                        [selectedUserProfile.user.counts.followers, "followers"],
                        [selectedUserProfile.user.counts.following, "following"],
                        [selectedUserProfile.user.counts.threads, "threads"],
                        [selectedUserProfile.user.counts.posts + selectedUserProfile.user.counts.replies, "comments"],
                      ].map(([value, label]) => (
                        <div className="rounded-[22px] border border-[color:var(--border)] bg-[color:var(--soft)] p-4" key={label}>
                          <p className="text-3xl font-semibold">{value}</p>
                          <p className="mt-2 text-xs uppercase tracking-[0.25em] text-[color:var(--muted)]">{label}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 rounded-[24px] border border-[color:var(--border)] bg-[color:var(--soft)] p-4">
                      <ActivityChart activity={selectedUserProfile.activity} />
                    </div>
                    <div className="mt-6 grid gap-4">
                      {selectedUserProfile.recent.threads.map((thread) => (
                        <button className="rounded-[20px] border border-[color:var(--border)] bg-[color:var(--soft)] px-4 py-3 text-left transition hover:border-[color:var(--accent)]" key={thread.id} onClick={() => router.push(`/forums?thread=${thread.id}`)} type="button">
                          <p className="font-semibold">{thread.title}</p>
                          <p className="mt-2 text-sm text-[color:var(--muted)]">{thread._count.posts} posts · {thread._count.polls} polls</p>
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}
              </Panel>

              <Panel>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted)]">Following</p>
                    <div className="mt-4 grid gap-3">
                      {following.length ? following.map((entry) => (
                        <button className="flex items-center gap-3 rounded-[20px] border border-[color:var(--border)] bg-[color:var(--soft)] px-4 py-3 text-left" key={`${entry.user.id}-${entry.followedAt}`} onClick={() => setSelectedUserId(entry.user.id)} type="button">
                          <Avatar image={entry.user.avatarUrl} label={entry.user.username} size="sm" />
                          <span>
                            <span className="block font-semibold">{entry.user.username}</span>
                            <span className="block text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">{formatCompactDate(entry.followedAt)}</span>
                          </span>
                        </button>
                      )) : <p className="text-sm text-[color:var(--muted)]">No followed users yet.</p>}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted)]">Followers</p>
                    <div className="mt-4 grid gap-3">
                      {followers.length ? followers.map((entry) => (
                        <div className="flex items-center justify-between gap-3 rounded-[20px] border border-[color:var(--border)] bg-[color:var(--soft)] px-4 py-3" key={`${entry.user.id}-${entry.followedAt}`}>
                          <button className="flex items-center gap-3 text-left" onClick={() => setSelectedUserId(entry.user.id)} type="button">
                            <Avatar image={entry.user.avatarUrl} label={entry.user.username} size="sm" />
                            <span className="font-semibold">{entry.user.username}</span>
                          </button>
                          <button className="rounded-full border border-[color:var(--border)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em]" disabled={busyKey === `remove-follower-${entry.user.id}`} onClick={() => handleRemoveFollower(entry.user.id)} type="button">Remove</button>
                        </div>
                      )) : <p className="text-sm text-[color:var(--muted)]">No followers yet.</p>}
                    </div>
                  </div>
                </div>
              </Panel>
            </div>
          </div>
        </section>
        ) : null}

        {showAccount ? (
        <section className="mt-10">
          <SectionTitle eyebrow="Accounts" title={currentUser ? "Your account controls" : "Sign in without leaving the page"} description="Email/password auth, GitHub or Google sign-in when configured, JWT-backed profile editing, and in-place appeal handling for banned users." />
          <div className="mt-6 grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
            <Panel className="bg-[linear-gradient(135deg,rgba(8,17,29,0.94),rgba(10,38,50,0.88))] text-white">
              {!currentUser ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <button className={cn("rounded-full px-4 py-2 text-sm font-semibold transition", authMode === "login" ? "bg-white text-slate-950" : "border border-white/15 bg-white/5 text-white/70")} onClick={() => setAuthMode("login")} type="button">Log in</button>
                    <button className={cn("rounded-full px-4 py-2 text-sm font-semibold transition", authMode === "register" ? "bg-white text-slate-950" : "border border-white/15 bg-white/5 text-white/70")} onClick={() => setAuthMode("register")} type="button">Sign up</button>
                  </div>
                  <form className="mt-6 grid gap-3" onSubmit={handleAuthSubmit}>
                    {authMode === "register" ? <input className="rounded-[22px] border border-white/15 bg-white/6 px-4 py-3 text-sm text-white placeholder:text-white/38" onChange={(event) => setAuthForm((current) => ({ ...current, username: event.target.value }))} placeholder="Username" required value={authForm.username} /> : null}
                    <input className="rounded-[22px] border border-white/15 bg-white/6 px-4 py-3 text-sm text-white placeholder:text-white/38" onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))} placeholder="Email" required type="email" value={authForm.email} />
                    <input className="rounded-[22px] border border-white/15 bg-white/6 px-4 py-3 text-sm text-white placeholder:text-white/38" minLength={6} onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))} placeholder="Password" required type="password" value={authForm.password} />
                    <button className="rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white" disabled={busyKey === "auth"} type="submit">{busyKey === "auth" ? "Working..." : authMode === "login" ? "Log in" : "Create account"}</button>
                  </form>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <button className="rounded-[22px] border border-white/12 bg-white/6 px-4 py-4 text-left transition hover:bg-white/10" disabled={oauthBusy === "github"} onClick={() => beginOauth("github")} type="button">
                      <p className="text-sm font-semibold">Continue with GitHub</p>
                      <p className="mt-1 text-sm text-white/60">{oauthConfig?.providers.github.enabled ? "Enabled for this deployment" : "Enable GITHUB_CLIENT_ID to activate"}</p>
                    </button>
                    <button className="rounded-[22px] border border-white/12 bg-white/6 px-4 py-4 text-left transition hover:bg-white/10" disabled={oauthBusy === "google"} onClick={() => beginOauth("google")} type="button">
                      <p className="text-sm font-semibold">Continue with Google</p>
                      <p className="mt-1 text-sm text-white/60">{oauthConfig?.providers.google.enabled ? "Enabled for this deployment" : "Enable GOOGLE_CLIENT_ID to activate"}</p>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-white/72">{currentUser.email}</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-[20px] border border-white/10 bg-black/14 p-4">
                      <p className="text-xs uppercase tracking-[0.25em] text-white/50">Role</p>
                      <p className="mt-2 text-2xl font-semibold">{currentUser.role}</p>
                    </div>
                    <div className="rounded-[20px] border border-white/10 bg-black/14 p-4">
                      <p className="text-xs uppercase tracking-[0.25em] text-white/50">Ban status</p>
                      <p className="mt-2 text-2xl font-semibold">{currentUser.banStatus ?? "NOT_BANNED"}</p>
                    </div>
                    <div className="rounded-[20px] border border-white/10 bg-black/14 p-4">
                      <p className="text-xs uppercase tracking-[0.25em] text-white/50">Favorite team</p>
                      <p className="mt-2 text-lg font-semibold">{teams.find((team) => team.id === currentUser.favoriteTeamId)?.shortName ?? "Unset"}</p>
                    </div>
                  </div>
                  {currentUser.banStatus === "BANNED" ? (
                    <form className="mt-6 rounded-[24px] border border-rose-400/30 bg-rose-500/10 p-4" onSubmit={handleAppealSubmit}>
                      <p className="text-sm font-semibold text-white">Appeal your ban</p>
                      <textarea className="mt-4 min-h-28 w-full rounded-[18px] border border-white/12 bg-white/6 px-4 py-3 text-sm text-white placeholder:text-white/38" onChange={(event) => setAppealMessage(event.target.value)} placeholder="Explain why the restrictions should be lifted" value={appealMessage} />
                      <button className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950" disabled={busyKey === "appeal"} type="submit">{busyKey === "appeal" ? "Submitting..." : "Submit appeal"}</button>
                    </form>
                  ) : null}
                </>
              )}
            </Panel>

            <Panel>
              <SectionTitle eyebrow="Profile Editor" title="Keep identity and preferences current" description="Users can edit their username, avatar, and favorite team without navigating away." />
              {currentUser ? (
                <form className="mt-5 grid gap-3" onSubmit={handleProfileSave}>
                  <input className="rounded-[22px] border border-[color:var(--border)] bg-transparent px-4 py-3 text-sm" onChange={(event) => setProfileForm((current) => ({ ...current, username: event.target.value }))} placeholder="Username" value={profileForm.username} />
                  <input className="rounded-[22px] border border-[color:var(--border)] bg-transparent px-4 py-3 text-sm" onChange={(event) => setProfileForm((current) => ({ ...current, avatarUrl: event.target.value }))} placeholder="Avatar image URL" value={profileForm.avatarUrl} />
                  <select className="rounded-[22px] border border-[color:var(--border)] bg-transparent px-4 py-3 text-sm" onChange={(event) => setProfileForm((current) => ({ ...current, favoriteTeamId: event.target.value }))} value={profileForm.favoriteTeamId}>
                    <option value="">No favorite team</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                  <button className="rounded-full bg-[color:var(--text)] px-5 py-3 text-sm font-semibold text-[color:var(--bg)]" disabled={busyKey === "profile"} type="submit">{busyKey === "profile" ? "Saving..." : "Save profile"}</button>
                </form>
              ) : (
                <div className="mt-5 rounded-[24px] border border-dashed border-[color:var(--border)] px-5 py-8 text-sm text-[color:var(--muted)]">This panel unlocks after sign-in so users can manage their profile and favorite team.</div>
              )}
            </Panel>
          </div>
        </section>
        ) : null}

        {showAdmin && currentUser?.role === "ADMIN" ? (
          <section className="mt-10">
            <SectionTitle eyebrow="Moderation" title="Admin review queue with AI context" description="AI-ranked report queues, grouped reasons, hidden-content approval, dismissal, and appeals all surface here for fast decision-making." />
            <div className="mt-6 grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
              <Panel>
                <div className="grid gap-4">
                  {reportsQueue.length ? reportsQueue.map((item) => {
                    const reportId = item.reports[0]?.id ?? item.target.id;
                    return (
                      <div className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--soft)] p-4" key={`${item.targetType}-${item.targetId}`}>
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="flex flex-wrap gap-2">
                              <span className="rounded-full bg-[color:var(--text)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-[color:var(--bg)]">{item.targetType}</span>
                              <span className="rounded-full border border-[color:var(--border)] px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-[color:var(--muted)]">{item.reportCount} reports</span>
                            </div>
                            <h3 className="mt-3 text-xl font-semibold">{item.target.title ?? truncate(item.target.body ?? "Reported content", 80)}</h3>
                            <p className="mt-2 text-sm text-[color:var(--muted)]">Latest report {formatShortDate(item.latestReportedAt)}</p>
                          </div>
                          <div className="rounded-[22px] border border-[color:var(--border)] bg-white/60 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--muted)]">AI verdict</p>
                            <p className="mt-3 text-2xl font-semibold">{item.aiVerdict.label} · {(item.aiVerdict.score * 100).toFixed(0)}%</p>
                            <p className="mt-2 text-sm text-[color:var(--muted)]">{item.aiVerdict.explanation ?? "No explanation provided"}</p>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-3">
                          {item.reports.map((report) => (
                            <div className="rounded-[18px] border border-[color:var(--border)] bg-white/60 px-4 py-3 text-sm" key={report.id}>
                              <p className="font-semibold">{report.reporter.username}</p>
                              <p className="mt-2 text-[color:var(--muted)]">{report.reason}</p>
                            </div>
                          ))}
                        </div>
                        <textarea className="mt-4 min-h-24 w-full rounded-[18px] border border-[color:var(--border)] bg-transparent px-4 py-3 text-sm" onChange={(event) => setModerationNote((current) => ({ ...current, [`report-${reportId}`]: event.target.value }))} placeholder="Moderator note" value={moderationNote[`report-${reportId}`] ?? ""} />
                        <div className="mt-4 flex flex-wrap gap-3">
                          <button className="rounded-full bg-[color:var(--text)] px-4 py-2 text-sm font-semibold text-[color:var(--bg)]" onClick={() => handleResolveReport(item, "DISMISS")} type="button">Dismiss</button>
                          <button className="rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white" onClick={() => handleResolveReport(item, "APPROVE")} type="button">Approve and hide</button>
                          <button className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white" onClick={() => handleResolveReport(item, "APPROVE", true)} type="button">Approve and ban</button>
                        </div>
                      </div>
                    );
                  }) : <div className="text-sm text-[color:var(--muted)]">No open reports in the queue right now.</div>}
                </div>
              </Panel>

              <Panel>
                <div className="grid gap-4">
                  {appeals.length ? appeals.map((appeal) => (
                    <div className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--soft)] p-4" key={appeal.id}>
                      <h3 className="text-xl font-semibold">{appeal.user.username}</h3>
                      <p className="mt-2 text-sm text-[color:var(--muted)]">Reason: {appeal.user.banReason ?? "No reason recorded"}</p>
                      <p className="mt-4 rounded-[18px] border border-[color:var(--border)] bg-white/60 px-4 py-3 text-sm text-[color:var(--muted)]">{appeal.message}</p>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button className="rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white" onClick={() => handleResolveAppeal(appeal.id, "APPROVE")} type="button">Approve appeal</button>
                        <button className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-semibold" onClick={() => handleResolveAppeal(appeal.id, "REJECT")} type="button">Reject appeal</button>
                      </div>
                    </div>
                  )) : <div className="text-sm text-[color:var(--muted)]">No open appeals waiting for review.</div>}
                </div>
              </Panel>
            </div>
          </section>
        ) : null}
      </div>

      {revisionViewer ? (
        <div className="fixed bottom-4 left-4 z-40 max-h-[50vh] w-[min(30rem,calc(100vw-2rem))] overflow-auto rounded-[24px] border border-white/10 bg-[color:var(--header)] p-4 text-white shadow-[0_24px_80px_-50px_rgba(8,17,29,0.9)]">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold capitalize">{revisionViewer.kind} history</p>
            <button className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em]" onClick={() => setRevisionViewer(null)} type="button">Close</button>
          </div>
          <div className="mt-4 grid gap-3">
            {revisionViewer.items.length ? revisionViewer.items.map((revision) => (
              <div className="rounded-[18px] border border-white/10 bg-white/5 p-3" key={revision.id}>
                <p className="text-xs uppercase tracking-[0.2em] text-white/55">{revision.editor.username} · {formatShortDate(revision.createdAt)}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-white/85">{revision.previousBody}</p>
              </div>
            )) : <p className="text-sm text-white/70">No earlier versions were recorded.</p>}
          </div>
        </div>
      ) : null}

      {flash ? (
        <div className="pointer-events-none fixed bottom-4 right-4 z-40 max-w-sm rounded-[22px] border border-white/10 bg-[color:var(--header)] px-4 py-3 text-sm text-white shadow-[0_24px_80px_-50px_rgba(8,17,29,0.9)]">
          <p className={cn("font-semibold", flash.tone === "success" && "text-emerald-300", flash.tone === "error" && "text-rose-300", flash.tone === "info" && "text-sky-300")}>{flash.text}</p>
        </div>
      ) : null}
    </main>
  );
}
