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

async function parsePostId(params: IdRouteContext["params"]) {
  const { id } = await params;
  return parseRequiredInt(id, "post id");
}

export async function GET(_request: Request, { params }: IdRouteContext) {
  try {
    const postId = await parsePostId(params);
    const post = await prisma.post.findUnique({
      where: { id: postId },
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
        thread: {
          select: {
            id: true,
            title: true,
            type: true,
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

    if (!post || post.status === "HIDDEN") {
      return jsonError("Post not found", 404);
    }

    return NextResponse.json({ post }, { status: 200 });
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
    const postId = await parsePostId(params);
    const existing = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        authorId: true,
        body: true,
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
    });

    if (!existing) {
      return jsonError("Post not found", 404);
    }

    if (!canManageResource(payload, existing.authorId)) {
      return jsonError("Forbidden", 403);
    }
    if (!isContentWritable(existing) || !existing.thread || !isThreadOpenForPosting(existing.thread)) {
      return jsonError("This post is no longer available for editing", 403);
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

    const post = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.postRevision.create({
        data: {
          postId,
          editorId: payload.userId,
          body: existing.body,
        },
      });

      return tx.post.update({
        where: { id: postId },
        data: {
          body: nextBody,
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
    });

    return NextResponse.json({ post }, { status: 200 });
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
    const postId = await parsePostId(params);
    const existing = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        authorId: true,
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
    });

    if (!existing) {
      return jsonError("Post not found", 404);
    }

    if (!canManageResource(payload, existing.authorId)) {
      return jsonError("Forbidden", 403);
    }
    if (!isContentWritable(existing) || !existing.thread || !isThreadOpenForPosting(existing.thread)) {
      return jsonError("This post is no longer available for deletion", 403);
    }

    await prisma.post.delete({ where: { id: postId } });
    return NextResponse.json({ message: "Post deleted" }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("positive integer")) {
      return jsonError(error.message, 400);
    }
    console.error(error);
    return jsonError("Internal server error", 500);
  }
}, { checkBan: true });
