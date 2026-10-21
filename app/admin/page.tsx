"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/providers";

type ReportQueueItem = {
  aiVerdict: {
    explanation: string | null;
    label: string;
    score: number;
    source?: string;
  };
  latestReportedAt: string;
  reportCount: number;
  reports: Array<{
    createdAt: string;
    id: number;
    reason: string;
    reporter: { id: number; username: string };
  }>;
  status: "OPEN";
  target: {
    authorId: number | null;
    body?: string;
    flagged?: boolean;
    id: number;
    postId?: number;
    status: string;
    threadId?: number;
    title?: string;
  };
  targetId: number | null;
  targetType: "post" | "reply" | "thread";
};

type AppealItem = {
  createdAt: string;
  id: number;
  message: string;
  status: string;
  user: {
    banReason: string | null;
    banStatus: "BANNED" | "NOT_BANNED";
    bannedAt: string | null;
    email: string;
    id: number;
    username: string;
  };
};

type PaginatedResponse<T> = {
  items: T[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
};

type RevisionEntry = {
  createdAt: string;
  editor: {
    id: number;
    username: string;
  } | null;
  id: number;
  previousBody: string;
};

type RevisionResponse = {
  currentBody: string;
  previousVersionCount: number;
  revisions: RevisionEntry[];
};

type QueueTab = "appeals" | "reports";
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

function trimText(value: string, limit = 180) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= limit) {
    return compact;
  }
  return `${compact.slice(0, limit - 1)}...`;
}

function scoreTone(score: number) {
  if (score >= 0.8) {
    return "text-rose-700";
  }
  if (score >= 0.45) {
    return "text-amber-700";
  }
  return "text-emerald-700";
}

export default function AdminPage() {
  const { accessToken, isAuthenticated, isLoading, user } = useAuth();

  const [reports, setReports] = useState<ReportQueueItem[]>([]);
  const [appeals, setAppeals] = useState<AppealItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<QueueTab>("reports");
  const [reportPage, setReportPage] = useState(1);
  const [appealPage, setAppealPage] = useState(1);
  const [reportTotal, setReportTotal] = useState(0);
  const [appealTotal, setAppealTotal] = useState(0);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [revisionLoadingKey, setRevisionLoadingKey] = useState<string | null>(null);
  const [revisionErrors, setRevisionErrors] = useState<Record<string, string>>({});
  const [revisionHistory, setRevisionHistory] = useState<Record<string, RevisionResponse>>({});
  const [expandedRevisionKey, setExpandedRevisionKey] = useState<string | null>(null);

  async function loadAdminData() {
    if (!accessToken) {
      return;
    }

    const reportOffset = (reportPage - 1) * PAGE_SIZE;
    const appealOffset = (appealPage - 1) * PAGE_SIZE;
    const [reportData, appealData] = await Promise.all([
      parseJson<PaginatedResponse<ReportQueueItem>>(
        await fetch(`/api/admin/reports?limit=${PAGE_SIZE}&offset=${reportOffset}`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        })
      ),
      parseJson<PaginatedResponse<AppealItem>>(
        await fetch(`/api/admin/appeals?limit=${PAGE_SIZE}&offset=${appealOffset}`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        })
      ),
    ]);

    setReports(reportData.items);
    setAppeals(appealData.items);
    setReportTotal(reportData.pagination.total);
    setAppealTotal(appealData.pagination.total);
  }

  useEffect(() => {
    if (isLoading) return;
    if (!accessToken || user?.role !== "ADMIN") {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      setError(null);

      try {
        const [reportData, appealData] = await Promise.all([
          parseJson<PaginatedResponse<ReportQueueItem>>(
            await fetch(`/api/admin/reports?limit=${PAGE_SIZE}&offset=${(reportPage - 1) * PAGE_SIZE}`, {
              cache: "no-store",
              headers: { Authorization: `Bearer ${accessToken}` },
            })
          ),
          parseJson<PaginatedResponse<AppealItem>>(
            await fetch(`/api/admin/appeals?limit=${PAGE_SIZE}&offset=${(appealPage - 1) * PAGE_SIZE}`, {
              cache: "no-store",
              headers: { Authorization: `Bearer ${accessToken}` },
            })
          ),
        ]);

        if (!cancelled) {
          setReports(reportData.items);
          setAppeals(appealData.items);
          setReportTotal(reportData.pagination.total);
          setAppealTotal(appealData.pagination.total);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load admin data");
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
  }, [accessToken, appealPage, isLoading, reportPage, user]);

  async function handleResolveReport(
    report: ReportQueueItem,
    action: "APPROVE" | "DISMISS",
    banUser: boolean
  ) {
    if (!accessToken) {
      return;
    }

    const note = notes[`report-${report.targetType}-${report.target.id}`]?.trim() || null;
    const busy = `report-${report.targetType}-${report.target.id}-${action}-${banUser ? "ban" : "keep"}`;
    setBusyKey(busy);
    setError(null);

    try {
      const reportId = report.reports[0]?.id;
      if (!reportId) {
        throw new Error("No report id available to resolve.");
      }

      await parseJson(
        await fetch(`/api/admin/reports/${reportId}/resolve`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ action, banUser, note }),
        })
      );

      await loadAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to resolve report");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleResolveAppeal(appealId: number, action: "APPROVE" | "REJECT") {
    if (!accessToken) {
      return;
    }

    const busy = `appeal-${appealId}-${action}`;
    setBusyKey(busy);
    setError(null);

    try {
      await parseJson(
        await fetch(`/api/admin/appeals/${appealId}/resolve`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ action }),
        })
      );

      await loadAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to resolve appeal");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleToggleRevisions(report: ReportQueueItem) {
    if (!accessToken) {
      return;
    }

    if (report.targetType === "thread") {
      return;
    }

    const revisionKey = `${report.targetType}-${report.target.id}`;

    if (expandedRevisionKey === revisionKey) {
      setExpandedRevisionKey(null);
      return;
    }

    if (revisionHistory[revisionKey]) {
      setExpandedRevisionKey(revisionKey);
      return;
    }

    setRevisionLoadingKey(revisionKey);
    setRevisionErrors((current) => {
      const next = { ...current };
      delete next[revisionKey];
      return next;
    });

    try {
      const endpoint =
        report.targetType === "post"
          ? `/api/posts/${report.target.id}/revisions`
          : `/api/replies/${report.target.id}/revisions`;

      const data = await parseJson<RevisionResponse>(
        await fetch(endpoint, {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
      );

      setRevisionHistory((current) => ({
        ...current,
        [revisionKey]: data,
      }));
      setExpandedRevisionKey(revisionKey);
    } catch (err) {
      setRevisionErrors((current) => ({
        ...current,
        [revisionKey]:
          err instanceof Error ? err.message : "Unable to load revision history",
      }));
    } finally {
      setRevisionLoadingKey(null);
    }
  }

  return (
    <main className="min-h-[calc(100vh-88px)] bg-[image:var(--hero-background)] px-6 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-8 shadow-[var(--shadow-hero)] backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[color:var(--accent-text)]">
                Admin
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[color:var(--foreground)]">
                Moderation control room.
              </h1>
              <p className="mt-3 text-base leading-7 text-[color:color-mix(in_srgb,var(--foreground)_72%,transparent)]">
                Review flagged content, resolve appeals, and keep the community
                readable without leaving the dashboard.
              </p>
            </div>

            <div className="grid gap-3 rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-5 py-4 text-sm sm:grid-cols-2">
              <div>
                <p className="uppercase tracking-[0.25em] text-[color:color-mix(in_srgb,var(--foreground)_55%,transparent)]">
                  Open Reports
                </p>
                <p className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">
                  {reports.length}
                </p>
              </div>
              <div>
                <p className="uppercase tracking-[0.25em] text-[color:color-mix(in_srgb,var(--foreground)_55%,transparent)]">
                  Open Appeals
                </p>
                <p className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">
                  {appeals.length}
                </p>
              </div>
            </div>
          </div>
        </section>

        {!isAuthenticated || user?.role !== "ADMIN" ? (
          <div className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-8 shadow-sm text-[color:var(--foreground)]">
            Admin access is required to view this page.
          </div>
        ) : loading ? (
          <div className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-8 shadow-sm text-[color:var(--foreground)]">
            Loading admin queues...
          </div>
        ) : (
          <>
            <section className="flex flex-wrap gap-2">
              {([
                { count: reportTotal, key: "reports" as const, label: "Reports" },
                { count: appealTotal, key: "appeals" as const, label: "Appeals" },
              ]).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    activeTab === tab.key
                      ? "bg-[color:var(--surface-strong)] text-[color:var(--surface-strong-foreground)]"
                      : "border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--foreground)] hover:bg-[color:var(--surface-muted)]"
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </section>

            {error ? (
              <div className="rounded-[2rem] border border-red-300/60 bg-red-100/70 p-6 text-red-800 shadow-sm">
                {error}
              </div>
            ) : null}

            {activeTab === "reports" ? (
              <section className="space-y-4">
                <div className="flex flex-col gap-3 rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-[color:color-mix(in_srgb,var(--foreground)_68%,transparent)]">
                    Showing {reports.length === 0 ? 0 : (reportPage - 1) * PAGE_SIZE + 1}-
                    {Math.min(reportPage * PAGE_SIZE, reportTotal)} of {reportTotal} reports
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setReportPage((current) => Math.max(1, current - 1))}
                      disabled={reportPage === 1}
                      className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-semibold transition hover:bg-[color:var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Previous
                    </button>
                    <span className="rounded-full bg-[color:var(--surface-muted)] px-4 py-2 text-sm font-semibold">
                      Page {reportPage}
                    </span>
                    <button
                      type="button"
                      onClick={() => setReportPage((current) => current + 1)}
                      disabled={reportPage * PAGE_SIZE >= reportTotal}
                      className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-semibold transition hover:bg-[color:var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Next
                    </button>
                  </div>
                </div>
                {reports.length === 0 ? (
                  <div className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-8 shadow-sm text-[color:var(--foreground)]">
                    No open reports.
                  </div>
                ) : (
                  reports.map((report) => {
                    const noteKey = `report-${report.targetType}-${report.target.id}`;

                    return (
                      <article
                        key={`${report.targetType}-${report.target.id}`}
                        className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm"
                      >
                        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                          <div className="max-w-4xl">
                            <div className="flex flex-wrap gap-2">
                              <span className="rounded-full bg-[color:var(--surface-muted)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--accent-text)]">
                                {report.targetType}
                              </span>
                              <span className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-semibold">
                                {report.reportCount} reports
                              </span>
                              <span
                                className={`rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-semibold ${scoreTone(
                                  report.aiVerdict.score
                                )}`}
                              >
                                AI {report.aiVerdict.label} {report.aiVerdict.score.toFixed(2)}
                              </span>
                            </div>

                            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">
                              {report.target.title || "Reported content"}
                            </h2>

                            {report.target.body ? (
                              <p className="mt-3 leading-7 text-[color:color-mix(in_srgb,var(--foreground)_80%,transparent)]">
                                {trimText(report.target.body)}
                              </p>
                            ) : null}

                            <div className="mt-4 grid gap-2 text-sm text-[color:color-mix(in_srgb,var(--foreground)_68%,transparent)]">
                              <p>Latest report: {formatDate(report.latestReportedAt)}</p>
                              <p>Content status: {report.target.status}</p>
                              {report.aiVerdict.explanation ? (
                                <p>AI note: {trimText(report.aiVerdict.explanation, 240)}</p>
                              ) : null}
                            </div>

                            <div className="mt-5 rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:color-mix(in_srgb,var(--foreground)_58%,transparent)]">
                                Reporter reasons
                              </p>
                              <div className="mt-3 space-y-3">
                                {report.reports.map((entry) => (
                                  <div key={entry.id} className="rounded-2xl bg-[color:var(--surface)] px-4 py-3">
                                    <p className="text-sm font-semibold text-[color:var(--foreground)]">
                                      {entry.reporter.username}
                                    </p>
                                    <p className="mt-1 text-sm text-[color:color-mix(in_srgb,var(--foreground)_72%,transparent)]">
                                      {entry.reason}
                                    </p>
                                    <p className="mt-2 text-xs text-[color:color-mix(in_srgb,var(--foreground)_55%,transparent)]">
                                      {formatDate(entry.createdAt)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="w-full max-w-sm rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-4">
                            {report.targetType === "thread" ? (
                              <Link
                                href={`/threads/${report.target.id}`}
                                className="inline-flex text-sm font-semibold text-[color:var(--accent-text)] hover:underline"
                              >
                                Open reported thread
                              </Link>
                            ) : report.target.threadId ? (
                              <Link
                                href={`/threads/${report.target.threadId}`}
                                className="inline-flex text-sm font-semibold text-[color:var(--accent-text)] hover:underline"
                              >
                                Open parent thread
                              </Link>
                            ) : null}

                            {report.targetType !== "thread" ? (
                              <button
                                type="button"
                                onClick={() => void handleToggleRevisions(report)}
                                disabled={revisionLoadingKey === `${report.targetType}-${report.target.id}`}
                                className="mt-4 inline-flex rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-semibold text-[color:var(--foreground)] transition hover:bg-[color:var(--surface)] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {revisionLoadingKey === `${report.targetType}-${report.target.id}`
                                  ? "Loading history..."
                                  : expandedRevisionKey === `${report.targetType}-${report.target.id}`
                                    ? "Hide revision history"
                                    : "View revision history"}
                              </button>
                            ) : null}

                            <label className="mt-4 block text-sm font-medium text-[color:var(--foreground)]">
                              Moderation note
                            </label>
                            <textarea
                              value={notes[noteKey] ?? ""}
                              onChange={(event) =>
                                setNotes((current) => ({
                                  ...current,
                                  [noteKey]: event.target.value,
                                }))
                              }
                              className="mt-2 min-h-28 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 outline-none transition focus:border-[color:var(--accent-text)]"
                              placeholder="Optional note for the moderation log"
                            />

                            <div className="mt-4 grid gap-3">
                              <button
                                type="button"
                                onClick={() => void handleResolveReport(report, "DISMISS", false)}
                                disabled={busyKey !== null}
                                className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-sm font-semibold text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {busyKey ===
                                `report-${report.targetType}-${report.target.id}-DISMISS-keep`
                                  ? "Dismissing..."
                                  : "Dismiss report"}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleResolveReport(report, "APPROVE", false)}
                                disabled={busyKey !== null}
                                className="rounded-2xl bg-[color:var(--surface-strong)] px-4 py-3 text-sm font-semibold text-[color:var(--surface-strong-foreground)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {busyKey ===
                                `report-${report.targetType}-${report.target.id}-APPROVE-keep`
                                  ? "Approving..."
                                  : "Hide content"}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleResolveReport(report, "APPROVE", true)}
                                disabled={busyKey !== null}
                                className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {busyKey ===
                                `report-${report.targetType}-${report.target.id}-APPROVE-ban`
                                  ? "Hiding and banning..."
                                  : "Hide content and ban author"}
                              </button>
                            </div>
                          </div>
                        </div>

                        {report.targetType !== "thread" &&
                        (expandedRevisionKey === `${report.targetType}-${report.target.id}` ||
                          revisionErrors[`${report.targetType}-${report.target.id}`]) ? (
                          <div className="mt-5 rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-5">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:color-mix(in_srgb,var(--foreground)_58%,transparent)]">
                                  Revision history
                                </p>
                                <p className="mt-2 text-sm text-[color:color-mix(in_srgb,var(--foreground)_70%,transparent)]">
                                  Review earlier versions before deciding whether the content was edited to evade moderation.
                                </p>
                              </div>
                              {revisionHistory[`${report.targetType}-${report.target.id}`] ? (
                                <p className="text-sm text-[color:color-mix(in_srgb,var(--foreground)_68%,transparent)]">
                                  {
                                    revisionHistory[`${report.targetType}-${report.target.id}`]
                                      .previousVersionCount
                                  }{" "}
                                  previous version
                                  {revisionHistory[`${report.targetType}-${report.target.id}`]
                                    .previousVersionCount === 1
                                    ? ""
                                    : "s"}
                                </p>
                              ) : null}
                            </div>

                            {revisionErrors[`${report.targetType}-${report.target.id}`] ? (
                              <div className="mt-4 rounded-2xl border border-red-300/60 bg-red-100/70 p-4 text-sm text-red-800">
                                {revisionErrors[`${report.targetType}-${report.target.id}`]}
                              </div>
                            ) : null}

                            {revisionHistory[`${report.targetType}-${report.target.id}`] ? (
                              <div className="mt-4 space-y-4">
                                <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
                                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:color-mix(in_srgb,var(--foreground)_58%,transparent)]">
                                    Current version
                                  </p>
                                  <p className="mt-3 whitespace-pre-wrap leading-7 text-[color:var(--foreground)]">
                                    {
                                      revisionHistory[`${report.targetType}-${report.target.id}`]
                                        .currentBody
                                    }
                                  </p>
                                </div>

                                {revisionHistory[`${report.targetType}-${report.target.id}`].revisions
                                  .length === 0 ? (
                                  <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 text-sm text-[color:color-mix(in_srgb,var(--foreground)_68%,transparent)]">
                                    No previous versions were stored for this content.
                                  </div>
                                ) : (
                                  revisionHistory[`${report.targetType}-${report.target.id}`].revisions.map(
                                    (revision, index) => (
                                      <div
                                        key={revision.id}
                                        className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4"
                                      >
                                        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                                          <p className="text-sm font-semibold text-[color:var(--foreground)]">
                                            Previous version #{index + 1}
                                          </p>
                                          <p className="text-xs text-[color:color-mix(in_srgb,var(--foreground)_58%,transparent)]">
                                            {formatDate(revision.createdAt)}
                                            {revision.editor
                                              ? ` · edited by ${revision.editor.username}`
                                              : ""}
                                          </p>
                                        </div>
                                        <p className="mt-3 whitespace-pre-wrap leading-7 text-[color:color-mix(in_srgb,var(--foreground)_82%,transparent)]">
                                          {revision.previousBody}
                                        </p>
                                      </div>
                                    )
                                  )
                                )}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </article>
                    );
                  })
                )}
              </section>
            ) : (
              <section className="space-y-4">
                <div className="flex flex-col gap-3 rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-[color:color-mix(in_srgb,var(--foreground)_68%,transparent)]">
                    Showing {appeals.length === 0 ? 0 : (appealPage - 1) * PAGE_SIZE + 1}-
                    {Math.min(appealPage * PAGE_SIZE, appealTotal)} of {appealTotal} appeals
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setAppealPage((current) => Math.max(1, current - 1))}
                      disabled={appealPage === 1}
                      className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-semibold transition hover:bg-[color:var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Previous
                    </button>
                    <span className="rounded-full bg-[color:var(--surface-muted)] px-4 py-2 text-sm font-semibold">
                      Page {appealPage}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAppealPage((current) => current + 1)}
                      disabled={appealPage * PAGE_SIZE >= appealTotal}
                      className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-semibold transition hover:bg-[color:var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Next
                    </button>
                  </div>
                </div>
                {appeals.length === 0 ? (
                  <div className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-8 shadow-sm text-[color:var(--foreground)]">
                    No open appeals.
                  </div>
                ) : (
                  appeals.map((appeal) => (
                    <article
                      key={appeal.id}
                      className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm"
                    >
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="max-w-4xl">
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-[color:var(--surface-muted)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--accent-text)]">
                              Appeal #{appeal.id}
                            </span>
                            <span className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-semibold">
                              {appeal.user.banStatus}
                            </span>
                          </div>

                          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">
                            {appeal.user.username}
                          </h2>
                          <p className="mt-1 text-sm text-[color:color-mix(in_srgb,var(--foreground)_68%,transparent)]">
                            {appeal.user.email}
                          </p>

                          <div className="mt-4 grid gap-2 text-sm text-[color:color-mix(in_srgb,var(--foreground)_68%,transparent)]">
                            <p>Appeal submitted: {formatDate(appeal.createdAt)}</p>
                            {appeal.user.bannedAt ? (
                              <p>Last banned at: {formatDate(appeal.user.bannedAt)}</p>
                            ) : null}
                            {appeal.user.banReason ? <p>Ban reason: {appeal.user.banReason}</p> : null}
                          </div>

                          <div className="mt-5 rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:color-mix(in_srgb,var(--foreground)_58%,transparent)]">
                              Appeal message
                            </p>
                            <p className="mt-3 leading-7 text-[color:var(--foreground)]">
                              {appeal.message}
                            </p>
                          </div>
                        </div>

                        <div className="w-full max-w-sm rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-4">
                          <div className="grid gap-3">
                            <button
                              type="button"
                              onClick={() => void handleResolveAppeal(appeal.id, "APPROVE")}
                              disabled={busyKey !== null}
                              className="rounded-2xl bg-[color:var(--surface-strong)] px-4 py-3 text-sm font-semibold text-[color:var(--surface-strong-foreground)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {busyKey === `appeal-${appeal.id}-APPROVE`
                                ? "Approving..."
                                : "Approve and unban"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleResolveAppeal(appeal.id, "REJECT")}
                              disabled={busyKey !== null}
                              className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-sm font-semibold text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {busyKey === `appeal-${appeal.id}-REJECT`
                                ? "Rejecting..."
                                : "Reject appeal"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
