"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/app/providers";

type PollOption = {
  id: number;
  text: string;
  votes: number;
};

type Poll = {
  authorId: number;
  createdAt: string;
  deadline: string;
  id: number;
  isVotingOpen: boolean;
  options: PollOption[];
  question: string;
  totalVotes: number;
  updatedAt?: string;
};

type Reply = {
  aiComment?: string | null;
  aiScore?: number | null;
  author: {
    avatarUrl: string | null;
    id: number;
    username: string;
  };
  authorId: number;
  body: string;
  createdAt: string;
  flagged?: boolean;
  id: number;
  updatedAt?: string;
};

type Post = {
  aiComment?: string | null;
  aiScore?: number | null;
  author: {
    avatarUrl: string | null;
    id: number;
    username: string;
  };
  authorId: number;
  body: string;
  createdAt: string;
  flagged?: boolean;
  id: number;
  replies: Reply[];
  updatedAt?: string;
};

type ThreadDetail = {
  author: {
    id: number;
    avatarUrl: string | null;
    username: string;
  } | null;
  authorId: number | null;
  createdAt?: string;
  id: number;
  isOpenForPosting: boolean;
  pagination: {
    limit: number;
    offset: number;
    totalPosts: number;
  };
  polls: Poll[];
  posts: Post[];
  tags: string[];
  title: string;
  type: "GENERAL" | "MATCH" | "TEAM";
};

type TranslationState = {
  busy: boolean;
  error: string | null;
  translatedText: string | null;
};

type ThreadSentiment = {
  awayFanCommentCount: number;
  awayTeam: string;
  awayTeamScore: number;
  commentCount: number;
  homeFanCommentCount: number;
  homeTeam: string;
  homeTeamScore: number;
  overall: string;
  overallScore: number;
};

type ReportTarget =
  | { kind: "thread"; label: string; threadId: number }
  | { kind: "post"; label: string; postId: number }
  | { kind: "reply"; label: string; replyId: number };

const POST_PAGE_SIZE = 10;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function toDateTimeLocalValue(value: string) {
  const date = new Date(value);
  const pad = (input: number) => String(input).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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

function trimText(value: string, limit = 220) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= limit) {
    return compact;
  }
  return `${compact.slice(0, limit - 1)}...`;
}

function AiNotice() {
  return (
    <div className="mt-4 rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p className="font-semibold">Potentially sensitive content</p>
      <p className="mt-2 leading-6 text-amber-900/90">
        This content may contain heated or harmful language.
      </p>
    </div>
  );
}

function moodToneClass(mood: string) {
  if (mood === "positive") {
    return "border-emerald-300/70 bg-emerald-50 text-emerald-900";
  }

  if (mood === "negative") {
    return "border-rose-300/70 bg-rose-50 text-rose-900";
  }

  return "border-amber-300/70 bg-amber-50 text-amber-900";
}

export default function ThreadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { accessToken, isAuthenticated, user } = useAuth();
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyBodies, setReplyBodies] = useState<Record<number, string>>({});
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [editingPostBody, setEditingPostBody] = useState("");
  const [postDeletingId, setPostDeletingId] = useState<number | null>(null);
  const [editingReplyId, setEditingReplyId] = useState<number | null>(null);
  const [editingReplyBody, setEditingReplyBody] = useState("");
  const [replySubmittingId, setReplySubmittingId] = useState<number | null>(null);
  const [replyDeletingId, setReplyDeletingId] = useState<number | null>(null);
  const [voteSubmittingId, setVoteSubmittingId] = useState<number | null>(null);
  const [translations, setTranslations] = useState<Record<string, TranslationState>>({});
  const [threadSentiment, setThreadSentiment] = useState<ThreadSentiment | null>(null);
  const [sentimentLoading, setSentimentLoading] = useState(false);
  const [sentimentError, setSentimentError] = useState<string | null>(null);
  const [editingThread, setEditingThread] = useState(false);
  const [threadTitleDraft, setThreadTitleDraft] = useState("");
  const [threadTagsDraft, setThreadTagsDraft] = useState("");
  const [threadSaving, setThreadSaving] = useState(false);
  const [threadDeleting, setThreadDeleting] = useState(false);
  const [creatingPoll, setCreatingPoll] = useState(false);
  const [newPollQuestion, setNewPollQuestion] = useState("");
  const [newPollDeadline, setNewPollDeadline] = useState("");
  const [newPollOptions, setNewPollOptions] = useState(["", ""]);
  const [editingPollId, setEditingPollId] = useState<number | null>(null);
  const [editingPollQuestion, setEditingPollQuestion] = useState("");
  const [editingPollDeadline, setEditingPollDeadline] = useState("");
  const [pollSavingId, setPollSavingId] = useState<number | null>(null);
  const [pollDeletingId, setPollDeletingId] = useState<number | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportFeedback, setReportFeedback] = useState<string | null>(null);
  const [postPage, setPostPage] = useState(1);
  const reportSectionRef = useRef<HTMLElement | null>(null);
  const reportTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  async function loadThread() {
    setLoading(true);
    setError(null);

    try {
      const data = await parseJson<{ thread: ThreadDetail }>(
        await fetch(
          `/api/threads/${id}?limit=${POST_PAGE_SIZE}&offset=${(postPage - 1) * POST_PAGE_SIZE}`,
          { cache: "no-store" }
        )
      );
      setThread(data.thread);
      setThreadTitleDraft(data.thread.title);
      setThreadTagsDraft(data.thread.tags.join(", "));

      if (
        data.thread.pagination.totalPosts > 0 &&
        data.thread.posts.length === 0 &&
        postPage > 1
      ) {
        setPostPage((current) => Math.max(1, current - 1));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load thread");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadThread();
  }, [id, postPage]);

  useEffect(() => {
    if (!thread || thread.type !== "MATCH") {
      setThreadSentiment(null);
      setSentimentError(null);
      return;
    }

    const threadId = thread.id;

    let cancelled = false;

    async function loadSentiment() {
      setSentimentLoading(true);
      setSentimentError(null);

      try {
        const data = await parseJson<ThreadSentiment>(
          await fetch(`/api/ai/sentiment/${threadId}`, {
            cache: "no-store",
          })
        );

        if (!cancelled) {
          setThreadSentiment(data);
        }
      } catch (err) {
        if (!cancelled) {
          setSentimentError(
            err instanceof Error ? err.message : "Unable to load sentiment analysis"
          );
        }
      } finally {
        if (!cancelled) {
          setSentimentLoading(false);
        }
      }
    }

    void loadSentiment();

    return () => {
      cancelled = true;
    };
  }, [thread]);

  useEffect(() => {
    if (!reportTarget) {
      return;
    }

    reportSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    window.setTimeout(() => {
      reportTextareaRef.current?.focus();
    }, 180);
  }, [reportTarget]);

  async function handlePostSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !thread) return;

    setSubmitting(true);
    setError(null);

    try {
      await parseJson(
        await fetch(`/api/threads/${thread.id}/posts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ body }),
        })
      );
      setBody("");
      await loadThread();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to post");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReplySubmit(postId: number) {
    if (!accessToken) {
      setError("Sign in to reply to posts.");
      return;
    }

    const nextBody = replyBodies[postId]?.trim() ?? "";
    if (!nextBody) {
      setError("Reply body cannot be empty.");
      return;
    }

    setReplySubmittingId(postId);
    setError(null);

    try {
      await parseJson(
        await fetch(`/api/posts/${postId}/replies`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ body: nextBody }),
        })
      );

      setReplyBodies((current) => ({ ...current, [postId]: "" }));
      await loadThread();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add reply");
    } finally {
      setReplySubmittingId(null);
    }
  }

  async function handleReplyEditSave(replyId: number) {
    if (!accessToken) {
      setError("Sign in to edit replies.");
      return;
    }

    const nextBody = editingReplyBody.trim();
    if (!nextBody) {
      setError("Reply body cannot be empty.");
      return;
    }

    setReplySubmittingId(replyId);
    setError(null);

    try {
      await parseJson(
        await fetch(`/api/replies/${replyId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ body: nextBody }),
        })
      );

      setEditingReplyId(null);
      setEditingReplyBody("");
      await loadThread();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update reply");
    } finally {
      setReplySubmittingId(null);
    }
  }

  async function handleReplyDelete(replyId: number) {
    if (!accessToken) {
      setError("Sign in to delete replies.");
      return;
    }

    setReplyDeletingId(replyId);
    setError(null);

    try {
      await parseJson(
        await fetch(`/api/replies/${replyId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
      );

      if (editingReplyId === replyId) {
        setEditingReplyId(null);
        setEditingReplyBody("");
      }

      await loadThread();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete reply");
    } finally {
      setReplyDeletingId(null);
    }
  }

  async function handlePostEditSave(postId: number) {
    if (!accessToken) {
      setError("Sign in to edit posts.");
      return;
    }

    const nextBody = editingPostBody.trim();
    if (!nextBody) {
      setError("Post body cannot be empty.");
      return;
    }

    setReplySubmittingId(postId);
    setError(null);

    try {
      await parseJson(
        await fetch(`/api/posts/${postId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ body: nextBody }),
        })
      );

      setEditingPostId(null);
      setEditingPostBody("");
      await loadThread();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update post");
    } finally {
      setReplySubmittingId(null);
    }
  }

  async function handlePostDelete(postId: number) {
    if (!accessToken) {
      setError("Sign in to delete posts.");
      return;
    }

    setPostDeletingId(postId);
    setError(null);

    try {
      await parseJson(
        await fetch(`/api/posts/${postId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
      );

      if (editingPostId === postId) {
        setEditingPostId(null);
        setEditingPostBody("");
      }

      await loadThread();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete post");
    } finally {
      setPostDeletingId(null);
    }
  }

  async function handleVote(pollId: number, optionId: number) {
    if (!accessToken) {
      setError("Sign in to vote in polls.");
      return;
    }

    setVoteSubmittingId(pollId);
    setError(null);

    try {
      await parseJson(
        await fetch(`/api/polls/${pollId}/votes`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ optionId }),
        })
      );
      await loadThread();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit vote");
    } finally {
      setVoteSubmittingId(null);
    }
  }

  async function handleTranslate(contentKey: string, text: string) {
    if (!accessToken) {
      setError("Sign in to translate content.");
      return;
    }

    setTranslations((current) => ({
      ...current,
      [contentKey]: {
        busy: true,
        error: null,
        translatedText: current[contentKey]?.translatedText ?? null,
      },
    }));

    try {
      const data = await parseJson<{ translatedText: string }>(
        await fetch("/api/ai/translate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            text,
            source: "Auto Detect",
            target: "English",
          }),
        })
      );

      setTranslations((current) => ({
        ...current,
        [contentKey]: {
          busy: false,
          error: null,
          translatedText: data.translatedText,
        },
      }));
    } catch (err) {
      setTranslations((current) => ({
        ...current,
        [contentKey]: {
          busy: false,
          error: err instanceof Error ? err.message : "Unable to translate content",
          translatedText: current[contentKey]?.translatedText ?? null,
        },
      }));
    }
  }

  async function handleThreadSave() {
    if (!accessToken || !thread) {
      setError("Sign in to edit this thread.");
      return;
    }

    setThreadSaving(true);
    setError(null);
    setReportFeedback(null);

    try {
      const tags = threadTagsDraft
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);

      await parseJson(
        await fetch(`/api/threads/${thread.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            title: threadTitleDraft.trim(),
            tags,
          }),
        })
      );

      setEditingThread(false);
      setReportFeedback("Thread updated successfully.");
      await loadThread();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update thread");
    } finally {
      setThreadSaving(false);
    }
  }

  async function handleThreadDelete() {
    if (!accessToken || !thread) {
      setError("Sign in to delete this thread.");
      return;
    }

    setThreadDeleting(true);
    setError(null);

    try {
      await parseJson(
        await fetch(`/api/threads/${thread.id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
      );

      router.push("/forums");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete thread");
      setThreadDeleting(false);
    }
  }

  async function handlePollCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !thread) {
      setError("Sign in to create a poll.");
      return;
    }

    setCreatingPoll(true);
    setError(null);

    try {
      await parseJson(
        await fetch(`/api/threads/${thread.id}/polls`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            question: newPollQuestion.trim(),
            deadline: newPollDeadline,
            options: newPollOptions,
          }),
        })
      );

      setNewPollQuestion("");
      setNewPollDeadline("");
      setNewPollOptions(["", ""]);
      setReportFeedback("Poll created successfully.");
      await loadThread();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create poll");
    } finally {
      setCreatingPoll(false);
    }
  }

  async function handlePollSave(pollId: number) {
    if (!accessToken) {
      setError("Sign in to edit this poll.");
      return;
    }

    setPollSavingId(pollId);
    setError(null);

    try {
      await parseJson(
        await fetch(`/api/polls/${pollId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            question: editingPollQuestion.trim(),
            deadline: editingPollDeadline,
          }),
        })
      );

      setEditingPollId(null);
      setEditingPollQuestion("");
      setEditingPollDeadline("");
      setReportFeedback("Poll updated successfully.");
      await loadThread();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update poll");
    } finally {
      setPollSavingId(null);
    }
  }

  async function handlePollDelete(pollId: number) {
    if (!accessToken) {
      setError("Sign in to delete this poll.");
      return;
    }

    setPollDeletingId(pollId);
    setError(null);

    try {
      await parseJson(
        await fetch(`/api/polls/${pollId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
      );

      if (editingPollId === pollId) {
        setEditingPollId(null);
        setEditingPollQuestion("");
        setEditingPollDeadline("");
      }

      await loadThread();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete poll");
    } finally {
      setPollDeletingId(null);
    }
  }

  async function handleReportSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !reportTarget) {
      setError("Sign in to report content.");
      return;
    }

    setReportSubmitting(true);
    setError(null);
    setReportFeedback(null);

    try {
      const payload =
        reportTarget.kind === "thread"
          ? { reason: reportReason.trim(), threadId: reportTarget.threadId }
          : reportTarget.kind === "post"
            ? { reason: reportReason.trim(), postId: reportTarget.postId }
            : { reason: reportReason.trim(), replyId: reportTarget.replyId };

      await parseJson(
        await fetch("/api/reports", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        })
      );

      setReportFeedback("Report submitted for moderator review.");
      setReportReason("");
      setReportTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit report");
    } finally {
      setReportSubmitting(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-88px)] bg-[image:var(--hero-background)] px-6 py-10 text-[color:var(--foreground)]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        {loading ? (
          <div className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-8 shadow-sm">
            Loading thread...
          </div>
        ) : error ? (
          <div className="rounded-[2rem] border border-red-300/60 bg-red-100/70 p-8 text-red-800 shadow-sm">
            {error}
          </div>
        ) : !thread ? null : (
          <>
            <section className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-8 shadow-[var(--shadow-hero)] backdrop-blur">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-[color:var(--surface-muted)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--accent-text)]">
                  {thread.type}
                </span>
                {thread.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs text-[color:color-mix(in_srgb,var(--foreground)_72%,transparent)]"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h1 className="text-4xl font-semibold tracking-tight">{thread.title}</h1>
                  <p className="mt-3 text-sm text-[color:color-mix(in_srgb,var(--foreground)_70%,transparent)]">
                    Started by {thread.author?.username ?? "System"} · {thread.posts.length} posts
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {user?.id === thread.authorId && thread.type !== "MATCH" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingThread((current) => !current);
                          setThreadTitleDraft(thread.title);
                          setThreadTagsDraft(thread.tags.join(", "));
                        }}
                        className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium transition hover:bg-[color:var(--surface-muted)]"
                      >
                        {editingThread ? "Close editor" : "Edit thread"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleThreadDelete()}
                        disabled={threadDeleting}
                        className="rounded-full border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {threadDeleting ? "Deleting..." : "Delete thread"}
                      </button>
                    </>
                  ) : null}
                  {isAuthenticated ? (
                    <button
                      type="button"
                      onClick={() =>
                        setReportTarget({
                          kind: "thread",
                          label: `Report thread: ${thread.title}`,
                          threadId: thread.id,
                        })
                      }
                      className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium transition hover:bg-[color:var(--surface-muted)]"
                    >
                      Report thread
                    </button>
                  ) : null}
                </div>
              </div>
              {editingThread ? (
                <div className="mt-6 rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-5">
                  <h2 className="text-lg font-semibold">Edit thread details</h2>
                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium">Title</label>
                      <input
                        value={threadTitleDraft}
                        onChange={(event) => setThreadTitleDraft(event.target.value)}
                        className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 outline-none transition focus:border-[color:var(--accent-text)]"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium">Tags</label>
                      <input
                        value={threadTagsDraft}
                        onChange={(event) => setThreadTagsDraft(event.target.value)}
                        className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 outline-none transition focus:border-[color:var(--accent-text)]"
                        placeholder="premier-league, predictions, derby"
                      />
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => void handleThreadSave()}
                        disabled={threadSaving}
                        className="rounded-2xl bg-[color:var(--surface-strong)] px-4 py-2 text-sm font-semibold text-[color:var(--surface-strong-foreground)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {threadSaving ? "Saving..." : "Save thread"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingThread(false)}
                        className="rounded-2xl border border-[color:var(--border)] px-4 py-2 text-sm font-semibold transition hover:bg-[color:var(--surface)]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </section>

            {reportTarget ? (
              <section
                ref={reportSectionRef}
                className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm"
              >
                <h2 className="text-xl font-semibold">Report content</h2>
                <p className="mt-2 text-sm text-[color:color-mix(in_srgb,var(--foreground)_68%,transparent)]">
                  {reportTarget.label}
                </p>
                <form onSubmit={handleReportSubmit} className="mt-4 space-y-4">
                  <textarea
                    ref={reportTextareaRef}
                    value={reportReason}
                    onChange={(event) => setReportReason(event.target.value)}
                    className="min-h-28 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3 outline-none transition focus:border-[color:var(--accent-text)]"
                    placeholder="Explain why this content should be reviewed..."
                    required
                  />
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      disabled={reportSubmitting}
                      className="rounded-2xl bg-[color:var(--surface-strong)] px-5 py-3 text-sm font-semibold text-[color:var(--surface-strong-foreground)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {reportSubmitting ? "Submitting..." : "Submit report"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReportTarget(null);
                        setReportReason("");
                      }}
                      className="rounded-2xl border border-[color:var(--border)] px-5 py-3 text-sm font-semibold transition hover:bg-[color:var(--surface-muted)]"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </section>
            ) : null}

            {reportFeedback ? (
              <div className="rounded-[2rem] border border-emerald-300/60 bg-emerald-100/70 p-6 text-emerald-800 shadow-sm">
                {reportFeedback}
              </div>
            ) : null}

            {thread.type === "MATCH" ? (
              <section className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">Match sentiment</h2>
                    <p className="mt-2 text-sm text-[color:color-mix(in_srgb,var(--foreground)_68%,transparent)]">
                      AI summary of the overall mood in this match thread and among fans of each side.
                    </p>
                  </div>
                  {sentimentLoading ? (
                    <span className="text-sm text-[color:color-mix(in_srgb,var(--foreground)_68%,transparent)]">
                      Analyzing comments...
                    </span>
                  ) : null}
                </div>

                {sentimentError ? (
                  <div className="mt-4 rounded-2xl border border-red-300/60 bg-red-100/70 p-4 text-sm text-red-800">
                    {sentimentError}
                  </div>
                ) : threadSentiment ? (
                  <div className="mt-5 grid gap-4 lg:grid-cols-3">
                    <div className={`rounded-3xl border p-5 ${moodToneClass(threadSentiment.overall)}`}>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em]">Overall</p>
                      <p className="mt-3 text-2xl font-semibold capitalize">{threadSentiment.overall}</p>
                      <p className="mt-2 text-sm">Score {threadSentiment.overallScore.toFixed(2)}</p>
                      <p className="mt-1 text-sm">{threadSentiment.commentCount} scored comments</p>
                    </div>
                    <div className={`rounded-3xl border p-5 ${moodToneClass(threadSentiment.homeTeam)}`}>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em]">Home fans</p>
                      <p className="mt-3 text-2xl font-semibold capitalize">{threadSentiment.homeTeam}</p>
                      <p className="mt-2 text-sm">Score {threadSentiment.homeTeamScore.toFixed(2)}</p>
                      <p className="mt-1 text-sm">{threadSentiment.homeFanCommentCount} fan comments</p>
                    </div>
                    <div className={`rounded-3xl border p-5 ${moodToneClass(threadSentiment.awayTeam)}`}>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em]">Away fans</p>
                      <p className="mt-3 text-2xl font-semibold capitalize">{threadSentiment.awayTeam}</p>
                      <p className="mt-2 text-sm">Score {threadSentiment.awayTeamScore.toFixed(2)}</p>
                      <p className="mt-1 text-sm">{threadSentiment.awayFanCommentCount} fan comments</p>
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}

            {thread.polls.length > 0 ? (
              <section className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm">
                <h2 className="text-xl font-semibold">Polls</h2>
                <div className="mt-4 space-y-4">
                  {thread.polls.map((poll) => (
                    <div
                      key={poll.id}
                      className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-5"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="max-w-3xl">
                          <p className="font-semibold">{poll.question}</p>
                          <p className="mt-1 text-sm text-[color:color-mix(in_srgb,var(--foreground)_70%,transparent)]">
                            {poll.totalVotes} votes · closes {formatDate(poll.deadline)}
                          </p>
                        </div>
                        <span className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
                          {poll.isVotingOpen ? "Voting Open" : "Closed"}
                        </span>
                      </div>
                      {user?.id === poll.authorId ? (
                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPollId(poll.id);
                              setEditingPollQuestion(poll.question);
                              setEditingPollDeadline(toDateTimeLocalValue(poll.deadline));
                            }}
                            className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-semibold transition hover:bg-[color:var(--surface)]"
                          >
                            Edit poll
                          </button>
                          <button
                            type="button"
                            onClick={() => void handlePollDelete(poll.id)}
                            disabled={pollDeletingId === poll.id}
                            className="rounded-full border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {pollDeletingId === poll.id ? "Deleting..." : "Delete poll"}
                          </button>
                        </div>
                      ) : null}
                      {editingPollId === poll.id ? (
                        <div className="mt-4 space-y-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
                          <div>
                            <label className="mb-2 block text-sm font-medium">Question</label>
                            <input
                              value={editingPollQuestion}
                              onChange={(event) => setEditingPollQuestion(event.target.value)}
                              className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3 outline-none transition focus:border-[color:var(--accent-text)]"
                            />
                          </div>
                          <div>
                            <label className="mb-2 block text-sm font-medium">Deadline</label>
                            <input
                              type="datetime-local"
                              value={editingPollDeadline}
                              onChange={(event) => setEditingPollDeadline(event.target.value)}
                              className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3 outline-none transition focus:border-[color:var(--accent-text)]"
                            />
                          </div>
                          <div className="flex flex-wrap gap-3">
                            <button
                              type="button"
                              onClick={() => void handlePollSave(poll.id)}
                              disabled={pollSavingId === poll.id}
                              className="rounded-2xl bg-[color:var(--surface-strong)] px-4 py-2 text-sm font-semibold text-[color:var(--surface-strong-foreground)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {pollSavingId === poll.id ? "Saving..." : "Save poll"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPollId(null);
                                setEditingPollQuestion("");
                                setEditingPollDeadline("");
                              }}
                              className="rounded-2xl border border-[color:var(--border)] px-4 py-2 text-sm font-semibold transition hover:bg-[color:var(--surface-muted)]"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-4 space-y-3">
                        {poll.options.map((option) => {
                          const percentage =
                            poll.totalVotes === 0
                              ? 0
                              : Math.round((option.votes / poll.totalVotes) * 100);

                          return (
                            <div key={option.id} className="rounded-2xl bg-[color:var(--surface)] p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-medium">{option.text}</p>
                                  <p className="mt-1 text-sm text-[color:color-mix(in_srgb,var(--foreground)_65%,transparent)]">
                                    {option.votes} votes · {percentage}%
                                  </p>
                                </div>
                                {poll.isVotingOpen ? (
                                  <button
                                    type="button"
                                    onClick={() => void handleVote(poll.id, option.id)}
                                    disabled={voteSubmittingId === poll.id || !isAuthenticated}
                                    className="rounded-full bg-[color:var(--surface-strong)] px-4 py-2 text-sm font-semibold text-[color:var(--surface-strong-foreground)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {voteSubmittingId === poll.id ? "Voting..." : "Vote"}
                                  </button>
                                ) : null}
                              </div>
                              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[color:var(--surface-muted)]">
                                <div
                                  className="h-full rounded-full bg-[color:var(--surface-strong)]"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {isAuthenticated && thread.isOpenForPosting ? (
              <section className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm">
                <h2 className="text-xl font-semibold">Create a poll</h2>
                <form onSubmit={handlePollCreate} className="mt-4 space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium">Question</label>
                    <input
                      value={newPollQuestion}
                      onChange={(event) => setNewPollQuestion(event.target.value)}
                      className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3 outline-none transition focus:border-[color:var(--accent-text)]"
                      placeholder="Who will be player of the match?"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium">Deadline</label>
                    <input
                      type="datetime-local"
                      value={newPollDeadline}
                      onChange={(event) => setNewPollDeadline(event.target.value)}
                      className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3 outline-none transition focus:border-[color:var(--accent-text)]"
                      required
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="block text-sm font-medium">Options</label>
                    {newPollOptions.map((option, index) => (
                      <input
                        key={`poll-option-${index + 1}`}
                        value={option}
                        onChange={(event) =>
                          setNewPollOptions((current) =>
                            current.map((entry, entryIndex) =>
                              entryIndex === index ? event.target.value : entry
                            )
                          )
                        }
                        className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3 outline-none transition focus:border-[color:var(--accent-text)]"
                        placeholder={`Option ${index + 1}`}
                        required={index < 2}
                      />
                    ))}
                    <button
                      type="button"
                      onClick={() => setNewPollOptions((current) => [...current, ""])}
                      className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-semibold transition hover:bg-[color:var(--surface-muted)]"
                    >
                      Add option
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={creatingPoll}
                    className="rounded-2xl bg-[color:var(--surface-strong)] px-5 py-3 text-sm font-semibold text-[color:var(--surface-strong-foreground)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {creatingPoll ? "Creating poll..." : "Create poll"}
                  </button>
                </form>
              </section>
            ) : null}

            <section className="space-y-4">
              <div className="flex flex-col gap-3 rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-[color:color-mix(in_srgb,var(--foreground)_68%,transparent)]">
                  Showing {thread.posts.length === 0 ? 0 : (postPage - 1) * POST_PAGE_SIZE + 1}-
                  {Math.min(postPage * POST_PAGE_SIZE, thread.pagination.totalPosts)} of{" "}
                  {thread.pagination.totalPosts} posts
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPostPage((current) => Math.max(1, current - 1))}
                    disabled={postPage === 1}
                    className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-semibold transition hover:bg-[color:var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Previous
                  </button>
                  <span className="rounded-full bg-[color:var(--surface-muted)] px-4 py-2 text-sm font-semibold">
                    Page {postPage}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPostPage((current) => current + 1)}
                    disabled={postPage * POST_PAGE_SIZE >= thread.pagination.totalPosts}
                    className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-semibold transition hover:bg-[color:var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Next
                  </button>
                </div>
              </div>
              {thread.posts.map((post) => (
                <article
                  key={post.id}
                  className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-[color:var(--accent-text)]">
                        {post.author.username}
                        {user?.id === post.authorId ? " · You" : ""}
                      </p>
                      <p className="mt-1 text-xs text-[color:color-mix(in_srgb,var(--foreground)_65%,transparent)]">
                        {formatDate(post.createdAt)}
                      </p>
                      <p className="mt-2">
                        <Link
                          href={`/users/${post.author.id}`}
                          className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--accent-text)] hover:text-[color:var(--foreground)]"
                        >
                          View profile
                        </Link>
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {user?.id === post.authorId ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPostId(post.id);
                              setEditingPostBody(post.body);
                            }}
                            className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold transition hover:bg-[color:var(--surface-muted)]"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handlePostDelete(post.id)}
                            disabled={postDeletingId === post.id}
                            className="rounded-full border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {postDeletingId === post.id ? "Deleting..." : "Delete"}
                          </button>
                        </>
                      ) : null}
                      {isAuthenticated ? (
                        <button
                          type="button"
                          onClick={() => void handleTranslate(`post-${post.id}`, post.body)}
                          disabled={translations[`post-${post.id}`]?.busy}
                          className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold transition hover:bg-[color:var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {translations[`post-${post.id}`]?.busy ? "Translating..." : "Translate"}
                        </button>
                      ) : null}
                      {isAuthenticated ? (
                        <button
                          type="button"
                          onClick={() =>
                            setReportTarget({
                              kind: "post",
                              label: `Report post by ${post.author.username}`,
                              postId: post.id,
                            })
                          }
                          className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold transition hover:bg-[color:var(--surface-muted)]"
                        >
                          Report
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {editingPostId === post.id ? (
                    <div className="mt-4 space-y-3">
                      <textarea
                        value={editingPostBody}
                        onChange={(event) => setEditingPostBody(event.target.value)}
                        className="min-h-28 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3 outline-none transition focus:border-[color:var(--accent-text)]"
                      />
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => void handlePostEditSave(post.id)}
                          disabled={replySubmittingId === post.id}
                          className="rounded-2xl bg-[color:var(--surface-strong)] px-4 py-2 text-sm font-semibold text-[color:var(--surface-strong-foreground)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {replySubmittingId === post.id ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPostId(null);
                            setEditingPostBody("");
                          }}
                          className="rounded-2xl border border-[color:var(--border)] px-4 py-2 text-sm font-semibold transition hover:bg-[color:var(--surface-muted)]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 whitespace-pre-wrap leading-7">{post.body}</p>
                  )}
                  {translations[`post-${post.id}`]?.translatedText ? (
                    <div className="mt-4 rounded-2xl border border-sky-300/70 bg-sky-50 px-4 py-3 text-sm text-sky-950">
                      <p className="font-semibold">English translation</p>
                      <p className="mt-2 whitespace-pre-wrap leading-6">
                        {translations[`post-${post.id}`]?.translatedText}
                      </p>
                    </div>
                  ) : null}
                  {translations[`post-${post.id}`]?.error ? (
                    <div className="mt-4 rounded-2xl border border-red-300/60 bg-red-100/70 px-4 py-3 text-sm text-red-800">
                      {translations[`post-${post.id}`]?.error}
                    </div>
                  ) : null}
                  {post.flagged ? <AiNotice /> : null}

                  {post.replies.length > 0 ? (
                    <div className="mt-5 space-y-3 border-t border-[color:var(--border)] pt-5">
                      {post.replies.map((reply) => (
                        <div
                          key={reply.id}
                          className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-4"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-sm font-medium">
                                {reply.author.username}
                                {user?.id === reply.authorId ? " · You" : ""}
                              </p>
                              <p className="mt-1 text-xs text-[color:color-mix(in_srgb,var(--foreground)_65%,transparent)]">
                                {formatDate(reply.createdAt)}
                              </p>
                              <p className="mt-2">
                                <Link
                                  href={`/users/${reply.author.id}`}
                                  className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--accent-text)] hover:text-[color:var(--foreground)]"
                                >
                                  View profile
                                </Link>
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {user?.id === reply.authorId ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingReplyId(reply.id);
                                      setEditingReplyBody(reply.body);
                                    }}
                                    className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold transition hover:bg-[color:var(--surface)]"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleReplyDelete(reply.id)}
                                    disabled={replyDeletingId === reply.id}
                                    className="rounded-full border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {replyDeletingId === reply.id ? "Deleting..." : "Delete"}
                                  </button>
                                </>
                              ) : null}
                              {isAuthenticated ? (
                                <button
                                  type="button"
                                  onClick={() => void handleTranslate(`reply-${reply.id}`, reply.body)}
                                  disabled={translations[`reply-${reply.id}`]?.busy}
                                  className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold transition hover:bg-[color:var(--surface)] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {translations[`reply-${reply.id}`]?.busy ? "Translating..." : "Translate"}
                                </button>
                              ) : null}
                              {isAuthenticated ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setReportTarget({
                                      kind: "reply",
                                      label: `Report reply by ${reply.author.username}`,
                                      replyId: reply.id,
                                    })
                                  }
                                  className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold transition hover:bg-[color:var(--surface)]"
                                >
                                  Report
                                </button>
                              ) : null}
                            </div>
                          </div>
                          {editingReplyId === reply.id ? (
                            <div className="mt-3 space-y-3">
                              <textarea
                                value={editingReplyBody}
                                onChange={(event) => setEditingReplyBody(event.target.value)}
                                className="min-h-24 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 outline-none transition focus:border-[color:var(--accent-text)]"
                              />
                              <div className="flex flex-wrap gap-3">
                                <button
                                  type="button"
                                  onClick={() => void handleReplyEditSave(reply.id)}
                                  disabled={replySubmittingId === reply.id}
                                  className="rounded-2xl bg-[color:var(--surface-strong)] px-4 py-2 text-sm font-semibold text-[color:var(--surface-strong-foreground)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {replySubmittingId === reply.id ? "Saving..." : "Save"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingReplyId(null);
                                    setEditingReplyBody("");
                                  }}
                                  className="rounded-2xl border border-[color:var(--border)] px-4 py-2 text-sm font-semibold transition hover:bg-[color:var(--surface)]"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="mt-3 whitespace-pre-wrap leading-6">{reply.body}</p>
                          )}
                          {translations[`reply-${reply.id}`]?.translatedText ? (
                            <div className="mt-4 rounded-2xl border border-sky-300/70 bg-sky-50 px-4 py-3 text-sm text-sky-950">
                              <p className="font-semibold">English translation</p>
                              <p className="mt-2 whitespace-pre-wrap leading-6">
                                {translations[`reply-${reply.id}`]?.translatedText}
                              </p>
                            </div>
                          ) : null}
                          {translations[`reply-${reply.id}`]?.error ? (
                            <div className="mt-4 rounded-2xl border border-red-300/60 bg-red-100/70 px-4 py-3 text-sm text-red-800">
                              {translations[`reply-${reply.id}`]?.error}
                            </div>
                          ) : null}
                          {reply.flagged ? <AiNotice /> : null}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-5 border-t border-[color:var(--border)] pt-5">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:color-mix(in_srgb,var(--foreground)_60%,transparent)]">
                      Reply to this post
                    </h3>
                    {isAuthenticated && thread.isOpenForPosting ? (
                      <div className="mt-3 space-y-3">
                        <textarea
                          value={replyBodies[post.id] ?? ""}
                          onChange={(event) =>
                            setReplyBodies((current) => ({
                              ...current,
                              [post.id]: event.target.value,
                            }))
                          }
                          className="min-h-24 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3 outline-none transition focus:border-[color:var(--accent-text)]"
                          placeholder="Write a reply..."
                        />
                        <button
                          type="button"
                          onClick={() => void handleReplySubmit(post.id)}
                          disabled={replySubmittingId === post.id}
                          className="rounded-2xl bg-[color:var(--surface-strong)] px-4 py-2.5 text-sm font-semibold text-[color:var(--surface-strong-foreground)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {replySubmittingId === post.id ? "Replying..." : "Post reply"}
                        </button>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-[color:color-mix(in_srgb,var(--foreground)_70%,transparent)]">
                        {thread.isOpenForPosting
                          ? "Sign in to reply."
                          : "This thread is closed for new replies."}
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </section>

            <section className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm">
              <h2 className="text-xl font-semibold">Join the conversation</h2>
              {isAuthenticated && thread.isOpenForPosting ? (
                <form onSubmit={handlePostSubmit} className="mt-4 space-y-4">
                  <textarea
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    className="min-h-32 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3 outline-none transition focus:border-[color:var(--accent-text)]"
                    placeholder="Add a new post to this thread..."
                    required
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-2xl bg-[color:var(--surface-strong)] px-5 py-3 text-sm font-semibold text-[color:var(--surface-strong-foreground)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? "Posting..." : "Post message"}
                  </button>
                </form>
              ) : (
                <p className="mt-3 text-sm text-[color:color-mix(in_srgb,var(--foreground)_70%,transparent)]">
                  {thread.isOpenForPosting
                    ? "Sign in to add your own post."
                    : "This thread is closed for new posts."}
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
