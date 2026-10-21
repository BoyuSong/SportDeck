import { NextResponse } from "next/server";
import type { Prisma } from "@/prisma/generated/index.js";
import { prisma } from "@/prisma/client";
import { withAuth } from "@/utils/auth";
import {
  canManageResource,
  type IdRouteContext,
  isThreadOpenForPosting,
  parseOptionalDate,
  parseRequiredInt,
  jsonError,
} from "@/utils/forum";

export const dynamic = "force-dynamic";

type PollResult = {
  author: { id: number; username: string } | null;
  authorId: number;
  createdAt: Date;
  deadline: Date;
  id: number;
  options: Array<{ _count: { votes: number }; id: number; text: string }>;
  question: string;
  threadId: number;
  updatedAt: Date;
  _count: { votes: number };
};

async function parsePollId(params: IdRouteContext["params"]) {
  const { id } = await params;
  return parseRequiredInt(id, "poll id");
}

function mapPollResult(poll: PollResult, now: Date) {
  const totalVotes = poll._count.votes;

  return {
    id: poll.id,
    threadId: poll.threadId,
    authorId: poll.authorId,
    question: poll.question,
    deadline: poll.deadline,
    createdAt: poll.createdAt,
    updatedAt: poll.updatedAt,
    author: poll.author,
    totalVotes,
    isVotingOpen: new Date(poll.deadline) > now,
    options: poll.options.map((option) => {
      const votes = option._count.votes;
      return {
        id: option.id,
        text: option.text,
        votes,
        percentage: totalVotes === 0 ? 0 : Number(((votes / totalVotes) * 100).toFixed(2)),
      };
    }),
  };
}

export async function GET(_request: Request, { params }: IdRouteContext) {
  try {
    const pollId = await parsePollId(params);
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      select: {
        id: true,
        threadId: true,
        authorId: true,
        question: true,
        deadline: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: {
            id: true,
            username: true,
          },
        },
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
    });

    if (!poll) {
      return jsonError("Poll not found", 404);
    }

    return NextResponse.json({ poll: mapPollResult(poll, new Date()) }, { status: 200 });
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
    const pollId = await parsePollId(params);
    const existing = await prisma.poll.findUnique({
      where: { id: pollId },
      select: {
        id: true,
        authorId: true,
        deadline: true,
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
      return jsonError("Poll not found", 404);
    }

    if (!canManageResource(payload, existing.authorId)) {
      return jsonError("Forbidden", 403);
    }
    if (!existing.thread || !isThreadOpenForPosting(existing.thread)) {
      return jsonError("This poll is no longer available for editing", 403);
    }

    const body = (await request.json()) as Record<string, unknown>;
    const data: Prisma.PollUpdateInput = {};

    if (body?.question !== undefined) {
      if (typeof body.question !== "string" || body.question.trim() === "") {
        return jsonError("question must be a non-empty string", 400);
      }
      data.question = body.question.trim();
    }

    if (body?.deadline !== undefined) {
      let deadline;
      try {
        deadline = parseOptionalDate(
          body.deadline as string | number | Date | null | undefined,
          "deadline"
        );
      } catch (error) {
        return jsonError(error instanceof Error ? error.message : "deadline must be valid", 400);
      }

      if (!deadline) {
        return jsonError("deadline must be provided", 400);
      }
      if (deadline <= new Date()) {
        return jsonError("deadline must be in the future", 400);
      }
      data.deadline = deadline;
    }

    if (Object.keys(data).length === 0) {
      return jsonError("No valid fields provided to update", 400);
    }

    const poll = await prisma.poll.update({
      where: { id: pollId },
      data,
      select: {
        id: true,
        threadId: true,
        authorId: true,
        question: true,
        deadline: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ poll }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("positive integer")) {
      return jsonError(error.message, 400);
    }
    console.error(error);
    return jsonError("Internal server error", 500);
  }
}, {checkBan: true });

export const DELETE = withAuth(async (_request, payload, { params }) => {
  try {
    const pollId = await parsePollId(params);
    const existing = await prisma.poll.findUnique({
      where: { id: pollId },
      select: {
        id: true,
        authorId: true,
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
      return jsonError("Poll not found", 404);
    }

    if (!canManageResource(payload, existing.authorId)) {
      return jsonError("Forbidden", 403);
    }
    if (!existing.thread || !isThreadOpenForPosting(existing.thread)) {
      return jsonError("This poll is no longer available for deletion", 403);
    }

    await prisma.poll.delete({ where: { id: pollId } });
    return NextResponse.json({ message: "Poll deleted" }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("positive integer")) {
      return jsonError(error.message, 400);
    }
    console.error(error);
    return jsonError("Internal server error", 500);
  }
}, { checkBan: true });
