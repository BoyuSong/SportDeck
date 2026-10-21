import { NextResponse } from "next/server";
import { prisma } from "@/prisma/client";
import { withAuth } from "@/utils/auth";
import {
  getThreadForWrite,
  isThreadOpenForPosting,
  type IdRouteContext,
  parseRequiredInt,
  parseOptionalDate,
  jsonError,
} from "@/utils/forum";

export const dynamic = "force-dynamic";

type PollRecord = {
  _count: { votes: number };
  author: { id: number; username: string } | null;
  authorId: number;
  createdAt: Date;
  deadline: Date;
  id: number;
  options: Array<{ _count: { votes: number }; id: number; text: string }>;
  question: string;
  threadId: number;
  updatedAt: Date;
};

async function parseThreadId(params: IdRouteContext["params"]) {
  const { id } = await params;
  return parseRequiredInt(id, "thread id");
}

function normalizeOptions(rawOptions: unknown): string[] {
  if (!Array.isArray(rawOptions)) return [];
  const dedup = new Set<string>();
  for (const rawOption of rawOptions) {
    if (typeof rawOption !== "string") continue;
    const option = rawOption.trim();
    if (!option) continue;
    dedup.add(option);
  }
  return [...dedup];
}

function mapPoll(poll: PollRecord, now: Date) {
  return {
    ...poll,
    totalVotes: poll._count.votes,
    isVotingOpen: new Date(poll.deadline) > now,
    options: poll.options.map((option: PollRecord["options"][number]) => ({
      id: option.id,
      text: option.text,
      votes: option._count.votes,
    })),
  };
}

export async function GET(_request: Request, { params }: IdRouteContext) {
  try {
    const threadId = await parseThreadId(params);
    const thread = await prisma.thread.findUnique({
      where: { id: threadId },
      select: { id: true, status: true },
    });
    if (!thread || thread.status === "HIDDEN") {
      return jsonError("Thread not found", 404);
    }

    const now = new Date();
    const polls = await prisma.poll.findMany({
      where: { threadId },
      orderBy: { createdAt: "asc" },
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

    return NextResponse.json(
      { total: polls.length, polls: polls.map((poll: PollRecord) => mapPoll(poll, now)) },
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
    const question =
      typeof body?.question === "string" ? body.question.trim() : "";
    if (!question) {
      return jsonError("question is required", 400);
    }

    let deadline;
    try {
      deadline = parseOptionalDate(body?.deadline, "deadline");
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "deadline is invalid", 400);
    }

    if (!deadline) {
      return jsonError("deadline is required", 400);
    }

    if (deadline <= new Date()) {
      return jsonError("deadline must be in the future", 400);
    }

    const options = normalizeOptions(body?.options);
    if (options.length < 2) {
      return jsonError("options must include at least two distinct values", 400);
    }

    const poll = await prisma.poll.create({
      data: {
        threadId,
        authorId: payload.userId,
        question,
        deadline,
        options: {
          create: options.map((option) => ({ text: option })),
        },
      },
      select: {
        id: true,
        threadId: true,
        authorId: true,
        question: true,
        deadline: true,
        createdAt: true,
        updatedAt: true,
        options: {
          select: {
            id: true,
            text: true,
          },
        },
      },
    });

    return NextResponse.json({ poll }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("positive integer")) {
      return jsonError(error.message, 400);
    }
    console.error(error);
    return jsonError("Internal server error", 500);
  }
}, { checkBan: true });
