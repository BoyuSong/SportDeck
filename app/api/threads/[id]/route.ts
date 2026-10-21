import { NextResponse, type NextRequest } from "next/server";
import type { Prisma } from "@/prisma/generated/index.js";
import { prisma } from "@/prisma/client";
import { withAuth } from "@/utils/auth";
import {
  buildTagCreateInput,
  canManageResource,
  type IdRouteContext,
  isContentWritable,
  isThreadOpenForPosting,
  isThreadVisibleForReading,
  mapTagNames,
  normalizeTagNames,
  parseRequiredInt,
  jsonError,
} from "@/utils/forum";

export const dynamic = "force-dynamic";

async function parseThreadId(params: IdRouteContext["params"]) {
  const { id } = await params;
  return parseRequiredInt(id, "thread id");
}

export async function GET(request: NextRequest, { params }: IdRouteContext) {
  try {
    const threadId = await parseThreadId(params);
    const now = new Date();
    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get("limit") ?? "10");
    const offsetParam = Number(searchParams.get("offset") ?? "0");
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(Math.trunc(limitParam), 1), 50)
      : 10;
    const offset = Number.isFinite(offsetParam)
      ? Math.max(Math.trunc(offsetParam), 0)
      : 0;

    const thread = await prisma.thread.findUnique({
      where: { id: threadId },
      select: {
        id: true,
        type: true,
        title: true,
        status: true,
        authorId: true,
        teamId: true,
        matchId: true,
        openAt: true,
        closeAt: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
            shortName: true,
            crestUrl: true,
          },
        },
        match: {
          select: {
            id: true,
            utcDate: true,
            status: true,
            venue: true,
            scoreHome: true,
            scoreAway: true,
            homeTeam: {
              select: {
                id: true,
                name: true,
                shortName: true,
                crestUrl: true,
              },
            },
            awayTeam: {
              select: {
                id: true,
                name: true,
                shortName: true,
                crestUrl: true,
              },
            },
          },
        },
        tags: {
          select: {
            tag: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        posts: {
          where: {
            status: { not: "HIDDEN" },
          },
          orderBy: { createdAt: "asc" },
          skip: offset,
          take: limit,
          select: {
            id: true,
            status: true,
            body: true,
            authorId: true,
            flagged: true,
            aiScore: true,
            aiComment: true,
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
              where: {
                status: { not: "HIDDEN" },
              },
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                status: true,
                body: true,
                authorId: true,
                flagged: true,
                aiScore: true,
                aiComment: true,
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
        },
        _count: {
          select: {
            posts: {
              where: {
                status: { not: "HIDDEN" },
              },
            },
          },
        },
        polls: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            question: true,
            deadline: true,
            authorId: true,
            createdAt: true,
            updatedAt: true,
            options: {
              select: {
                id: true,
                text: true,
                _count: {
                  select: {
                    votes: true,
                  },
                },
              },
            },
            _count: {
              select: {
                votes: true,
              },
            },
          },
        },
      },
    });

    if (!thread) {
      return jsonError("Thread not found", 404);
    }

    if (!isThreadVisibleForReading(thread, now)) {
      return jsonError("Thread is not open yet", 403);
    }

    const polls = thread.polls.map((poll: (typeof thread.polls)[number]) => ({
      ...poll,
      isVotingOpen: new Date(poll.deadline) > now,
      totalVotes: poll._count.votes,
      options: poll.options.map((option: (typeof poll.options)[number]) => ({
        id: option.id,
        text: option.text,
        votes: option._count.votes,
      })),
    }));

    return NextResponse.json(
      {
        thread: {
          ...thread,
          tags: mapTagNames(thread),
          isOpenForPosting: isThreadOpenForPosting(thread, now),
          polls,
          pagination: {
            limit,
            offset,
            totalPosts: thread._count.posts,
          },
        },
      },
      { status: 200 }
    );
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
    const threadId = await parseThreadId(params);
    const thread = await prisma.thread.findUnique({
      where: { id: threadId },
      select: {
        id: true,
        authorId: true,
        type: true,
        status: true,
        openAt: true,
        closeAt: true,
      },
    });

    if (!thread) {
      return jsonError("Thread not found", 404);
    }

    if (thread.authorId === null || !canManageResource(payload, thread.authorId)) {
      return jsonError("Forbidden", 403);
    }
    if (!isContentWritable(thread) || !isThreadOpenForPosting(thread)) {
      return jsonError("This thread is no longer available for editing", 403);
    }

    if (thread.type === "MATCH") {
      return jsonError("Match threads cannot be edited manually", 400);
    }

    const body = (await request.json()) as Record<string, unknown>;
    const data: Prisma.ThreadUpdateInput = {};

    if (body?.title !== undefined) {
      if (typeof body.title !== "string" || body.title.trim() === "") {
        return jsonError("title must be a non-empty string", 400);
      }
      data.title = body.title.trim();
    }

    if (body?.teamId !== undefined) {
      if (thread.type !== "TEAM") {
        return jsonError("teamId can only be changed for TEAM threads", 400);
      }
      const teamId = parseRequiredInt(body.teamId as string | number, "teamId");
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { id: true },
      });
      if (!team) {
        return jsonError("teamId not found", 400);
      }
      data.team = { connect: { id: teamId } };
    }

    const shouldReplaceTags = body?.tags !== undefined;
    const tags = shouldReplaceTags ? normalizeTagNames(body.tags) : [];

    if (Object.keys(data).length === 0 && !shouldReplaceTags) {
      return jsonError("No valid fields provided to update", 400);
    }

    const updated = await prisma.thread.update({
      where: { id: threadId },
      data: {
        ...data,
        ...(shouldReplaceTags
          ? {
              tags: {
                deleteMany: {},
                create: buildTagCreateInput(tags),
              },
            }
          : {}),
      },
      select: {
        id: true,
        type: true,
        title: true,
        status: true,
        authorId: true,
        teamId: true,
        createdAt: true,
        updatedAt: true,
        tags: {
          select: {
            tag: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(
      {
        thread: {
          ...updated,
          tags: mapTagNames(updated),
        },
      },
      { status: 200 }
    );
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
    const threadId = await parseThreadId(params);
    const thread = await prisma.thread.findUnique({
      where: { id: threadId },
      select: {
        id: true,
        authorId: true,
        type: true,
        status: true,
        openAt: true,
        closeAt: true,
      },
    });

    if (!thread) {
      return jsonError("Thread not found", 404);
    }

    if (thread.authorId === null || !canManageResource(payload, thread.authorId)) {
      return jsonError("Forbidden", 403);
    }
    if (!isContentWritable(thread) || !isThreadOpenForPosting(thread)) {
      return jsonError("This thread is no longer available for deletion", 403);
    }

    if (thread.type === "MATCH") {
      return jsonError("Match threads cannot be deleted manually", 400);
    }

    await prisma.thread.delete({ where: { id: threadId } });
    return NextResponse.json({ message: "Thread deleted" }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("positive integer")) {
      return jsonError(error.message, 400);
    }
    console.error(error);
    return jsonError("Internal server error", 500);
  }
}, { checkBan: true });
