import { NextResponse } from "next/server";
import type { Prisma } from "@/prisma/generated/index.js";
import { prisma } from "@/prisma/client";
import { withAuth } from "@/utils/auth";
import { getCommentAiFields } from "@/utils/comment-ai";
import { createFeedEventsForPostCreation } from "@/utils/feed";
import {
  getThreadForWrite,
  isThreadOpenForPosting,
  isThreadVisibleForReading,
  type IdRouteContext,
  parseOptionalInt,
  parseRequiredInt,
  jsonError,
} from "@/utils/forum";

export const dynamic = "force-dynamic";

async function parseThreadId(params: IdRouteContext["params"]) {
  const { id } = await params;
  return parseRequiredInt(id, "thread id");
}

export async function GET(request: Request, { params }: IdRouteContext) {
  try {
    const threadId = await parseThreadId(params);
    const { searchParams } = new URL(request.url);
    const authorId = parseOptionalInt(searchParams.get("authorId"), "authorId");

    const thread = await prisma.thread.findUnique({
      where: { id: threadId },
      select: {
        id: true,
        type: true,
        status: true,
        openAt: true,
        closeAt: true,
      },
    });

    if (!thread) {
      return jsonError("Thread not found", 404);
    }

    if (!isThreadVisibleForReading(thread, new Date())) {
      return jsonError("Thread is not open yet", 403);
    }

    const where: Prisma.PostWhereInput = {
      threadId,
      status: { not: "HIDDEN" },
      ...(authorId !== null ? { authorId } : {}),
    };

    const posts = await prisma.post.findMany({
      where,
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        threadId: true,
        authorId: true,
        status: true,
        body: true,
        flagged: true,
        aiScore: true,
        aiComment: true,
        sentimentLabel: true,
        sentimentScore: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
        replies: {
          where: { status: { not: "HIDDEN" } },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            authorId: true,
            status: true,
            body: true,
            flagged: true,
            aiScore: true,
            aiComment: true,
            sentimentLabel: true,
            sentimentScore: true,
            createdAt: true,
            updatedAt: true,
            author: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ total: posts.length, posts }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("positive integer")) {
      return jsonError(error.message, 400);
    }
    console.error(error);
    return jsonError("Internal server error", 500);
  }
}

export const POST = withAuth(async (request, payload, { params }) => {
  try {
    const threadId = await parseThreadId(params);

    const thread = await getThreadForWrite(threadId);
    if (!thread) {
      return jsonError("Thread not found", 404);
    }
    if (!isThreadOpenForPosting(thread, new Date())) {
      return jsonError("Thread is closed for posting", 403);
    }

    const body = await request.json();
    const postBody = typeof body?.body === "string" ? body.body.trim() : "";
    if (!postBody) {
      return jsonError("body is required", 400);
    }
    const aiFields = await getCommentAiFields(postBody);

    const post = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const createdPost = await tx.post.create({
        data: {
          threadId,
          authorId: payload.userId,
          body: postBody,
          ...aiFields,
        },
        select: {
          id: true,
          threadId: true,
          authorId: true,
          status: true,
          body: true,
          flagged: true,
          aiScore: true,
          aiComment: true,
          sentimentLabel: true,
          sentimentScore: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await createFeedEventsForPostCreation(tx, {
        actorId: payload.userId,
        postId: createdPost.id,
        threadId,
      });

      return createdPost;
    });

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("positive integer")) {
      return jsonError(error.message, 400);
    }
    console.error(error);
    return jsonError("Internal server error", 500);
  }
}, { checkBan: true });
