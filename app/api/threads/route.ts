import { NextResponse, type NextRequest } from "next/server";
import type { Prisma, ThreadType } from "@/prisma/generated/index.js";
import { prisma } from "@/prisma/client";
import { withAuth } from "@/utils/auth";
import { createFeedEventsForThreadCreation } from "@/utils/feed";
import {
  buildTagCreateInput,
  ensureAutoMatchThreads,
  isThreadOpenForPosting,
  mapTagNames,
  normalizeTagNames,
  parseOptionalInt,
  parseRequiredInt,
  jsonError,
} from "@/utils/forum";

export const dynamic = "force-dynamic";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;
const ALLOWED_TYPES = new Set<ThreadType>(["GENERAL", "TEAM", "MATCH"]);

function parseType(value: string | null): ThreadType | null {
  if (!value) return null;
  const normalized = String(value).trim().toUpperCase() as ThreadType;
  if (!ALLOWED_TYPES.has(normalized)) {
    throw new Error("type must be GENERAL, TEAM, or MATCH");
  }
  return normalized;
}

function parseLimit(value: string | null) {
  if (!value) return DEFAULT_LIMIT;
  const parsed = parseRequiredInt(value, "limit");
  return Math.min(parsed, MAX_LIMIT);
}

function parseOffset(value: string | null) {
  if (!value) return 0;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error("offset must be a non-negative integer");
  }
  return parsed;
}

function parseTags(searchParams: URLSearchParams) {
  const repeated = searchParams.getAll("tag");
  const csv = searchParams.get("tags");
  const csvParts = csv ? csv.split(",") : [];
  return normalizeTagNames([...repeated, ...csvParts]);
}

export async function GET(request: NextRequest) {
  try {
    await ensureAutoMatchThreads();

    const { searchParams } = new URL(request.url);

    const type = parseType(searchParams.get("type"));
    const teamId = parseOptionalInt(searchParams.get("teamId"), "teamId");
    const authorId = parseOptionalInt(searchParams.get("authorId"), "authorId");
    const matchId = parseOptionalInt(searchParams.get("matchId"), "matchId");
    const limit = parseLimit(searchParams.get("limit"));
    const offset = parseOffset(searchParams.get("offset"));
    const q = searchParams.get("q")?.trim() || null;
    const author = searchParams.get("author")?.trim() || null;
    const tags = parseTags(searchParams);
    const now = new Date();

    const andConditions: Prisma.ThreadWhereInput[] = [
      { status: { not: "HIDDEN" } },
      {
        OR: [
          { type: { not: "MATCH" } },
          { openAt: null },
          { openAt: { lte: now } },
        ],
      },
    ];

    if (type) {
      andConditions.push({ type });
    }

    if (teamId !== null) {
      andConditions.push({
        OR: [
          { teamId },
          {
            type: "MATCH",
            match: {
              is: {
                OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
              },
            },
          },
        ],
      });
    }

    if (authorId !== null) {
      andConditions.push({ authorId });
    }

    if (matchId !== null) {
      andConditions.push({ matchId });
    }

    if (q) {
      andConditions.push({ title: { contains: q } });
    }

    if (author) {
      andConditions.push({
        author: {
          is: {
            username: { contains: author },
          },
        },
      });
    }

    if (tags.length > 0) {
      andConditions.push({
        tags: {
          some: {
            tag: {
              name: { in: tags },
            },
          },
        },
      });
    }

    const where: Prisma.ThreadWhereInput = { AND: andConditions };

    const [threads, total] = await Promise.all([
      prisma.thread.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: [{ updatedAt: "desc" }],
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
            },
          },
          team: {
            select: {
              id: true,
              name: true,
              shortName: true,
            },
          },
          match: {
            select: {
              id: true,
              utcDate: true,
              status: true,
              homeTeam: {
                select: {
                  id: true,
                  name: true,
                  shortName: true,
                },
              },
              awayTeam: {
                select: {
                  id: true,
                  name: true,
                  shortName: true,
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
          _count: {
            select: {
              posts: true,
              polls: true,
            },
          },
        },
      }),
      prisma.thread.count({ where }),
    ]);

    const payload = threads.map((thread: (typeof threads)[number]) => ({
      ...thread,
      tags: mapTagNames(thread),
      isOpenForPosting: isThreadOpenForPosting(thread, now),
    }));

    return NextResponse.json(
      {
        total,
        pagination: { limit, offset },
        filters: { type, teamId, authorId, matchId, q, author, tags },
        threads: payload,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("must be")) {
      return jsonError(error.message, 400);
    }
    console.error(error);
    return jsonError("Internal server error", 500);
  }
}

export const POST = withAuth(async (request, payload) => {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const firstPostBody =
      typeof body?.body === "string" ? body.body.trim() : "";

    if (!title) {
      return jsonError("title is required", 400);
    }
    if (!firstPostBody) {
      return jsonError("body is required", 400);
    }

    const type = body?.type
      ? (String(body.type).trim().toUpperCase() as ThreadType)
      : "GENERAL";
    if (!ALLOWED_TYPES.has(type) || type === "MATCH") {
      return jsonError("type must be GENERAL or TEAM for user-created threads", 400);
    }

    let teamId = null;
    if (type === "TEAM") {
      try {
        teamId = parseRequiredInt(body.teamId as string | number, "teamId");
      } catch (error) {
        return jsonError(error instanceof Error ? error.message : "teamId is invalid", 400);
      }

      const teamExists = await prisma.team.findUnique({
        where: { id: teamId },
        select: { id: true },
      });
      if (!teamExists) {
        return jsonError("teamId not found", 400);
      }
    }

    const tagNames = normalizeTagNames(body?.tags);
    const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const thread = await tx.thread.create({
        data: {
          type,
          title,
          authorId: payload.userId,
          teamId,
          tags: {
            create: buildTagCreateInput(tagNames),
          },
          posts: {
            create: {
              authorId: payload.userId,
              body: firstPostBody,
            },
          },
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
                select: { name: true },
              },
            },
          },
          posts: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              body: true,
              authorId: true,
              createdAt: true,
            },
            take: 1,
          },
        },
      });

      await createFeedEventsForThreadCreation(tx, {
        actorId: payload.userId,
        threadId: thread.id,
        teamId,
        title,
        type,
      });

      return thread;
    });

    return NextResponse.json(
      {
        thread: {
          ...created,
          tags: mapTagNames(created),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return jsonError("Internal server error", 500);
  }
}, { checkBan: true });
