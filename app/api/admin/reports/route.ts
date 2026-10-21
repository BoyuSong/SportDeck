// get the report queue GET
import { NextResponse } from "next/server";
import type { Prisma } from "@/prisma/generated/index.js";
import { prisma } from "@/prisma/client";
import { withAuth } from "@/utils/auth";
export const dynamic = "force-dynamic";


type ReportRecord = Prisma.ReportGetPayload<{
  include: {
    reporter: {
      select: {
        id: true;
        username: true;
      };
    };
  };
}>;
type TargetType = "post" | "reply" | "thread";
type AiVerdict = {
  explanation: string | null;
  label: string;
  score: number;
  source: "POST" | "REPLY" | "THREAD" | "NONE";
};

function getTargetType(report: ReportRecord): TargetType {
  if (report.threadId) return "thread";
  if (report.postId) return "post";
  return "reply";
}

function getTargetId(report: ReportRecord): number | null {
  return report.threadId ?? report.postId ?? report.replyId;
}

function getTargetKey(report: ReportRecord) {
  return `${getTargetType(report)}-${getTargetId(report)}`;
}

const threadSelect = {
  id: true,
  title: true,
  status: true,
  authorId: true,
  posts: {
    select: {
      id: true,
      body: true,
      flagged: true,
      aiScore: true,
      aiComment: true,
      replies: {
        select: {
          id: true,
          body: true,
          flagged: true,
          aiScore: true,
          aiComment: true,
        },
      },
    },
  },
} satisfies Prisma.ThreadSelect;

const postSelect = {
  id: true,
  body: true,
  status: true,
  authorId: true,
  flagged: true,
  aiScore: true,
  aiComment: true,
  threadId: true,
} satisfies Prisma.PostSelect;

const replySelect = {
  id: true,
  body: true,
  status: true,
  authorId: true,
  flagged: true,
  aiScore: true,
  aiComment: true,
  postId: true,
} satisfies Prisma.ReplySelect;

type ThreadRecord = Prisma.ThreadGetPayload<{ select: typeof threadSelect }>;
type PostRecord = Prisma.PostGetPayload<{ select: typeof postSelect }>;
type ReplyRecord = Prisma.ReplyGetPayload<{ select: typeof replySelect }>;

export const GET = withAuth(
  async (request) => {
    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get("limit") ?? "20");
    const offsetParam = Number(searchParams.get("offset") ?? "0");
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(Math.trunc(limitParam), 1), 100)
      : 20;
    const offset = Number.isFinite(offsetParam)
      ? Math.max(Math.trunc(offsetParam), 0)
      : 0;

    const reports = await prisma.report.findMany({
      where: {
        status: "OPEN",
      },
      include: {
        reporter: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const threadIds = Array.from(
      new Set<number>(
        reports
          .map((r: ReportRecord) => r.threadId)
          .filter((id: number | null): id is number => id !== null)
      )
    );
    const postIds = Array.from(
      new Set<number>(
        reports
          .map((r: ReportRecord) => r.postId)
          .filter((id: number | null): id is number => id !== null)
      )
    );
    const replyIds = Array.from(
      new Set<number>(
        reports
          .map((r: ReportRecord) => r.replyId)
          .filter((id: number | null): id is number => id !== null)
      )
    );

    const [threads, posts, replies] = await Promise.all([
      threadIds.length
        ? prisma.thread.findMany({
            where: { id: { in: threadIds } },
            select: threadSelect,
          })
        : [],
      postIds.length
        ? prisma.post.findMany({
            where: { id: { in: postIds } },
            select: postSelect,
          })
        : [],
      replyIds.length
        ? prisma.reply.findMany({
            where: { id: { in: replyIds } },
            select: replySelect,
          })
        : [],
    ]);

    const threadMap = new Map<number, ThreadRecord>(
      threads.map((t: ThreadRecord) => [t.id, t])
    );
    const postMap = new Map<number, PostRecord>(
      posts.map((p: PostRecord) => [p.id, p])
    );
    const replyMap = new Map<number, ReplyRecord>(
      replies.map((r: ReplyRecord) => [r.id, r])
    );

    function getTargetSummary(report: ReportRecord) {
      if (report.threadId) {
        const thread = threadMap.get(report.threadId);
        if (!thread) return null;

        return {
          id: thread.id,
          title: thread.title,
          status: thread.status,
          authorId: thread.authorId,
        };
      }

      if (report.postId) {
        const post = postMap.get(report.postId);
        if (!post) return null;

        return {
          id: post.id,
          body: post.body,
          status: post.status,
          authorId: post.authorId,
          threadId: post.threadId,
          flagged: post.flagged,
        };
      }

      if (report.replyId === null) {
        return null;
      }

      const reply = replyMap.get(report.replyId);
      if (!reply) return null;

      return {
        id: reply.id,
        body: reply.body,
        status: reply.status,
        authorId: reply.authorId,
        postId: reply.postId,
        flagged: reply.flagged,
      };
    }

    function getAiVerdict(report: ReportRecord): AiVerdict {
      const baseVerdict: AiVerdict = {
        label: "OTHER",
        score: 0,
        explanation: null,
        source: "NONE",
      };

      if (report.postId) {
        const post = postMap.get(report.postId);
        return {
          label: post?.flagged ? "FLAGGED" : "OTHER",
          score: post?.aiScore ?? 0,
          explanation: post?.aiComment ?? null,
          source: "POST",
        };
      }

      if (report.replyId) {
        const reply = replyMap.get(report.replyId);
        return {
          label: reply?.flagged ? "FLAGGED" : "OTHER",
          score: reply?.aiScore ?? 0,
          explanation: reply?.aiComment ?? null,
          source: "REPLY",
        };
      }

      if (report.threadId) {
        const thread = threadMap.get(report.threadId);
        if (!thread) {
          return baseVerdict;
        }

        let bestVerdict = baseVerdict;
        for (const post of thread.posts) {
          const postVerdict: AiVerdict = {
            label: post.flagged ? "FLAGGED" : "OTHER",
            score: post.aiScore ?? 0,
            explanation: post.aiComment ?? null,
            source: "POST",
          };
          if (postVerdict.score > bestVerdict.score) {
            bestVerdict = postVerdict;
          }

          for (const reply of post.replies) {
            const replyVerdict: AiVerdict = {
              label: reply.flagged ? "FLAGGED" : "OTHER",
              score: reply.aiScore ?? 0,
              explanation: reply.aiComment ?? null,
              source: "REPLY",
            };
            if (replyVerdict.score > bestVerdict.score) {
              bestVerdict = replyVerdict;
            }
          }
        }

        return {
          ...bestVerdict,
          source: (bestVerdict.source === "NONE" ? "THREAD" : bestVerdict.source) as AiVerdict["source"],
        };
      }

      return {
        ...baseVerdict,
      };
    }

    const grouped = new Map<
      string,
      {
        aiVerdict: AiVerdict;
        latestReportedAt: Date;
        reportCount: number;
        reports: Array<{
          createdAt: Date;
          id: number;
          reason: string;
          reporter: ReportRecord["reporter"];
        }>;
        status: "OPEN";
        target: NonNullable<ReturnType<typeof getTargetSummary>>;
        targetId: number | null;
        targetType: TargetType;
      }
    >();

    for (const report of reports) {
      const key = getTargetKey(report);
      const targetType = getTargetType(report);
      const targetId = getTargetId(report);
      const target = getTargetSummary(report);

      // target not exists
      if (!target) continue;

      const aiVerdict = getAiVerdict(report);

      if (!grouped.has(key)) {
        grouped.set(key, {
          targetType,
          targetId,
          target,
          status: "OPEN",
          reportCount: 0,
          reports: [],
          aiVerdict,
          latestReportedAt: report.createdAt,
        });
      }

      const item = grouped.get(key);
      if (!item) {
        continue;
      }

      item.reportCount += 1;
      item.reports.push({
        id: report.id,
        reason: report.reason,
        createdAt: report.createdAt,
        reporter: report.reporter,
      });

      // save the higher AI score
      if ((aiVerdict.score ?? 0) > (item.aiVerdict?.score ?? 0)) {
        item.aiVerdict = aiVerdict;
      }

      if (report.createdAt > item.latestReportedAt) {
        item.latestReportedAt = report.createdAt;
      }
    }

    const queue = Array.from(grouped.values()).sort((a, b) => {
      const scoreDiff = (b.aiVerdict?.score ?? 0) - (a.aiVerdict?.score ?? 0);
      if (scoreDiff !== 0) return scoreDiff;

      const countDiff = b.reportCount - a.reportCount;
      if (countDiff !== 0) return countDiff;

      return b.latestReportedAt.getTime() - a.latestReportedAt.getTime();
    });

    const total = queue.length;
    const items = queue.slice(offset, offset + limit);

    return NextResponse.json(
      {
        items,
        pagination: {
          limit,
          offset,
          total,
        },
      },
      { status: 200 }
    );
  },
  { requireRole: "ADMIN" }
);
