import { NextResponse } from "next/server";
import type { Prisma } from "@/prisma/generated/index.js";
import { prisma } from "@/prisma/client";
import { withAuth } from "@/utils/auth";
import { getCommentAiFields } from "@/utils/comment-ai";
import { createFeedEventsForReplyCreation } from "@/utils/feed";
import {
  getThreadForWrite,
  isThreadOpenForPosting,
  type IdRouteContext,
  parseOptionalInt,
  parseRequiredInt,
  jsonError,
} from "@/utils/forum";

export const dynamic = "force-dynamic";

async function parsePostId(params: IdRouteContext["params"]) {
  const { id } = await params;
  return parseRequiredInt(id, "post id");
}

export async function GET(request: Request, { params }: IdRouteContext) {
  try {
    const postId = await parsePostId(params);
    const { searchParams } = new URL(request.url);
    const authorId = parseOptionalInt(searchParams.get("authorId"), "authorId");

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!post || post.status === "HIDDEN") {
      return jsonError("Post not found", 404);
    }

    const replies = await prisma.reply.findMany({
      where: {
        postId,
        status: { not: "HIDDEN" },
        ...(authorId !== null ? { authorId } : {}),
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        postId: true,
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
    });

    return NextResponse.json({ total: replies.length, replies }, { status: 200 });
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
    const postId = await parsePostId(params);

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        status: true,
        threadId: true,
        authorId: true,
        thread: {
          select: {
            authorId: true,
          },
        },
      },
    });
    if (!post || post.status === "HIDDEN") {
      return jsonError("Post not found", 404);
    }

    const thread = await getThreadForWrite(post.threadId);
    if (!thread) {
      return jsonError("Thread not found", 404);
    }
    if (!isThreadOpenForPosting(thread, new Date())) {
      return jsonError("Thread is closed for posting", 403);
    }

    const body = await request.json();
    const replyBody = typeof body?.body === "string" ? body.body.trim() : "";
    if (!replyBody) {
      return jsonError("body is required", 400);
    }
    const aiFields = await getCommentAiFields(replyBody);

    const reply = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const createdReply = await tx.reply.create({
        data: {
          postId,
          authorId: payload.userId,
          body: replyBody,
          ...aiFields,
        },
        select: {
          id: true,
          postId: true,
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

      await createFeedEventsForReplyCreation(tx, {
        actorId: payload.userId,
        postAuthorId: post.authorId,
        postId,
        replyId: createdReply.id,
        threadAuthorId: post.thread?.authorId ?? null,
        threadId: post.threadId,
      });

      return createdReply;
    });

    return NextResponse.json({ reply }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("positive integer")) {
      return jsonError(error.message, 400);
    }
    console.error(error);
    return jsonError("Internal server error", 500);
  }
}, { checkBan: true });
