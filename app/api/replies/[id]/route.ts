import { NextResponse } from "next/server";
import type { Prisma } from "@/prisma/generated/index.js";
import { prisma } from "@/prisma/client";
import { withAuth } from "@/utils/auth";
import { getCommentAiFields } from "@/utils/comment-ai";
import {
  canManageResource,
  type IdRouteContext,
  isContentWritable,
  isThreadOpenForPosting,
  parseRequiredInt,
  jsonError,
} from "@/utils/forum";

export const dynamic = "force-dynamic";

async function parseReplyId(params: IdRouteContext["params"]) {
  const { id } = await params;
  return parseRequiredInt(id, "reply id");
}

export async function GET(_request: Request, { params }: IdRouteContext) {
  try {
    const replyId = await parseReplyId(params);
    const reply = await prisma.reply.findUnique({
      where: { id: replyId },
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
        post: {
          select: {
            id: true,
            threadId: true,
          },
        },
      },
    });

    if (!reply || reply.status === "HIDDEN") {
      return jsonError("Reply not found", 404);
    }

    return NextResponse.json({ reply }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("positive integer")) {
      return jsonError(error.message, 400);
    }
    console.error(error);
    return jsonError("Internal server error", 500);
  }
}

export const PATCH = withAuth(async (request, payload, { params }) => {
  try {
    const replyId = await parseReplyId(params);
    const existing = await prisma.reply.findUnique({
      where: { id: replyId },
      select: {
        id: true,
        authorId: true,
        body: true,
        status: true,
        post: {
          select: {
            id: true,
            status: true,
            thread: {
              select: {
                id: true,
                type: true,
                status: true,
                openAt: true,
                closeAt: true,
              },
            },
          },
        },
      },
    });

    if (!existing) {
      return jsonError("Reply not found", 404);
    }

    if (!canManageResource(payload, existing.authorId)) {
      return jsonError("Forbidden", 403);
    }
    if (
      !isContentWritable(existing) ||
      !existing.post ||
      !isContentWritable(existing.post) ||
      !existing.post.thread ||
      !isThreadOpenForPosting(existing.post.thread)
    ) {
      return jsonError("This reply is no longer available for editing", 403);
    }

    const body = await request.json();
    const nextBody = typeof body?.body === "string" ? body.body.trim() : "";
    if (!nextBody) {
      return jsonError("body must be a non-empty string", 400);
    }
    if (nextBody === existing.body) {
      return jsonError("body is unchanged", 400);
    }
    const aiFields = await getCommentAiFields(nextBody);

    const reply = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.replyRevision.create({
        data: {
          replyId,
          editorId: payload.userId,
          body: existing.body,
        },
      });

      return tx.reply.update({
        where: { id: replyId },
        data: {
          body: nextBody,
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
    });

    return NextResponse.json({ reply }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("positive integer")) {
      return jsonError(error.message, 400);
    }
    console.error(error);
    return jsonError("Internal server error", 500);
  }
}, { checkBan: true });

export const DELETE = withAuth(async (_request, payload, { params }) => {
  try {
    const replyId = await parseReplyId(params);
    const existing = await prisma.reply.findUnique({
      where: { id: replyId },
      select: {
        id: true,
        authorId: true,
        status: true,
        post: {
          select: {
            id: true,
            status: true,
            thread: {
              select: {
                id: true,
                type: true,
                status: true,
                openAt: true,
                closeAt: true,
              },
            },
          },
        },
      },
    });

    if (!existing) {
      return jsonError("Reply not found", 404);
    }

    if (!canManageResource(payload, existing.authorId)) {
      return jsonError("Forbidden", 403);
    }
    if (
      !isContentWritable(existing) ||
      !existing.post ||
      !isContentWritable(existing.post) ||
      !existing.post.thread ||
      !isThreadOpenForPosting(existing.post.thread)
    ) {
      return jsonError("This reply is no longer available for deletion", 403);
    }

    await prisma.reply.delete({ where: { id: replyId } });
    return NextResponse.json({ message: "Reply deleted" }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("positive integer")) {
      return jsonError(error.message, 400);
    }
    console.error(error);
    return jsonError("Internal server error", 500);
  }
}, { checkBan: true });
