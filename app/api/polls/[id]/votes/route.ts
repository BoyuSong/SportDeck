import { NextResponse } from "next/server";
import { prisma } from "@/prisma/client";
import { withAuth } from "@/utils/auth";
import {
  type IdRouteContext,
  isThreadOpenForPosting,
  parseRequiredInt,
  jsonError,
} from "@/utils/forum";

export const dynamic = "force-dynamic";

async function parsePollId(params: IdRouteContext["params"]) {
  const { id } = await params;
  return parseRequiredInt(id, "poll id");
}

export async function GET(_request: Request, { params }: IdRouteContext) {
  try {
    const pollId = await parsePollId(params);

    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      select: {
        id: true,
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

    const totalVotes = poll._count.votes;
    const results = poll.options.map((option: (typeof poll.options)[number]) => {
      const votes = option._count.votes;
      return {
        optionId: option.id,
        text: option.text,
        votes,
        percentage: totalVotes === 0 ? 0 : Number(((votes / totalVotes) * 100).toFixed(2)),
      };
    });

    return NextResponse.json({ pollId, totalVotes, results }, { status: 200 });
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
    const pollId = await parsePollId(params);

    const body = (await request.json()) as Record<string, unknown>;
    let optionId;
    try {
      optionId = parseRequiredInt(body.optionId as string | number, "optionId");
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "optionId is invalid", 400);
    }

    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      select: {
        id: true,
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
        options: {
          select: { id: true },
        },
      },
    });
    if (!poll) {
      return jsonError("Poll not found", 404);
    }

    if (new Date() > new Date(poll.deadline)) {
      return jsonError("Poll is closed", 403);
    }
    if (!poll.thread || !isThreadOpenForPosting(poll.thread)) {
      return jsonError("This poll is no longer available for voting", 403);
    }

    const optionExists = poll.options.some((option: (typeof poll.options)[number]) => option.id === optionId);
    if (!optionExists) {
      return jsonError("optionId does not belong to this poll", 400);
    }

    const vote = await prisma.pollVote.upsert({
      where: {
        pollId_voterId: {
          pollId,
          voterId: payload.userId,
        },
      },
      update: {
        optionId,
      },
      create: {
        pollId,
        optionId,
        voterId: payload.userId,
      },
      select: {
        id: true,
        pollId: true,
        optionId: true,
        voterId: true,
        createdAt: true,
      },
    });

    const options = await prisma.pollOption.findMany({
      where: { pollId },
      select: {
        id: true,
        text: true,
        _count: {
          select: {
            votes: true,
          },
        },
      },
    });
    const totalVotes = options.reduce(
      (sum: number, option: (typeof options)[number]) => sum + option._count.votes,
      0
    );

    return NextResponse.json(
      {
        vote,
        results: options.map((option: (typeof options)[number]) => ({
          optionId: option.id,
          text: option.text,
          votes: option._count.votes,
          percentage:
            totalVotes === 0 ? 0 : Number(((option._count.votes / totalVotes) * 100).toFixed(2)),
        })),
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
