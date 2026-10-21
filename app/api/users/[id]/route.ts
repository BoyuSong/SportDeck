import { NextResponse } from "next/server";
import { prisma } from "@/prisma/client";
import type { IdRouteContext } from "@/utils/forum";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

function parsePagination(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

export async function GET(request: Request, { params }: IdRouteContext) {
  const { id } = await params;
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const content = (searchParams.get("content") ?? "threads") as
    | "threads"
    | "posts"
    | "replies";
  const limit = Math.min(
    Math.max(parsePagination(searchParams.get("limit"), DEFAULT_LIMIT), 1),
    MAX_LIMIT
  );
  const offset = Math.max(parsePagination(searchParams.get("offset"), 0), 0);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      avatarUrl: true,
      favoriteTeamId: true,
      createdAt: true,
      favoriteTeam: {
        select: {
          id: true,
          name: true,
          shortName: true,
          crestUrl: true,
        },
      },
      _count: {
        select: {
          followers: true,
          following: true,
          threads: true,
          posts: true,
          replies: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const since = new Date();
  since.setDate(since.getDate() - 29);

  const [threads, posts, replies, selectedTotal, activityRows] = await Promise.all([
    content === "threads"
      ? prisma.thread.findMany({
          where: {
            authorId: userId,
            status: { not: "HIDDEN" },
          },
          orderBy: { createdAt: "desc" },
          skip: offset,
          take: limit,
          select: {
            id: true,
            title: true,
            type: true,
            status: true,
            createdAt: true,
            updatedAt: true,
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
            _count: {
              select: {
                posts: true,
                polls: true,
              },
            },
          },
        })
      : [],
    content === "posts"
      ? prisma.post.findMany({
          where: {
            authorId: userId,
            status: { not: "HIDDEN" },
          },
          orderBy: { createdAt: "desc" },
          skip: offset,
          take: limit,
          select: {
            id: true,
            body: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            thread: {
              select: {
                id: true,
                title: true,
                type: true,
              },
            },
            _count: {
              select: {
                replies: true,
              },
            },
          },
        })
      : [],
    content === "replies"
      ? prisma.reply.findMany({
          where: {
            authorId: userId,
            status: { not: "HIDDEN" },
          },
          orderBy: { createdAt: "desc" },
          skip: offset,
          take: limit,
          select: {
            id: true,
            body: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            post: {
              select: {
                id: true,
                thread: {
                  select: {
                    id: true,
                    title: true,
                    type: true,
                  },
                },
              },
            },
          },
        })
      : [],
    content === "threads"
      ? prisma.thread.count({
          where: {
            authorId: userId,
            status: { not: "HIDDEN" },
          },
        })
      : content === "posts"
        ? prisma.post.count({
            where: {
              authorId: userId,
              status: { not: "HIDDEN" },
            },
          })
        : prisma.reply.count({
            where: {
              authorId: userId,
              status: { not: "HIDDEN" },
            },
          }),
    Promise.all([
      prisma.thread.findMany({
        where: {
          authorId: userId,
          status: { not: "HIDDEN" },
          createdAt: { gte: since },
        },
        select: { createdAt: true },
      }),
      prisma.post.findMany({
        where: {
          authorId: userId,
          status: { not: "HIDDEN" },
          createdAt: { gte: since },
        },
        select: { createdAt: true },
      }),
      prisma.reply.findMany({
        where: {
          authorId: userId,
          status: { not: "HIDDEN" },
          createdAt: { gte: since },
        },
        select: { createdAt: true },
      }),
    ]),
  ]);

  const activityMap = new Map<string, { date: string; threads: number; posts: number; replies: number }>();

  for (let index = 0; index < 30; index += 1) {
    const date = new Date(since);
    date.setDate(since.getDate() + index);
    const key = date.toISOString().slice(0, 10);
    activityMap.set(key, { date: key, threads: 0, posts: 0, replies: 0 });
  }

  for (const row of activityRows[0]) {
    const key = row.createdAt.toISOString().slice(0, 10);
    const bucket = activityMap.get(key);
    if (bucket) bucket.threads += 1;
  }

  for (const row of activityRows[1]) {
    const key = row.createdAt.toISOString().slice(0, 10);
    const bucket = activityMap.get(key);
    if (bucket) bucket.posts += 1;
  }

  for (const row of activityRows[2]) {
    const key = row.createdAt.toISOString().slice(0, 10);
    const bucket = activityMap.get(key);
    if (bucket) bucket.replies += 1;
  }

  return NextResponse.json(
    {
      user: {
        ...user,
        counts: {
          followers: user._count.followers,
          following: user._count.following,
          threads: user._count.threads,
          posts: user._count.posts,
          replies: user._count.replies,
        },
      },
      activity: Array.from(activityMap.values()),
      recent: {
        threads,
        posts,
        replies,
      },
      recentPagination: {
        content,
        limit,
        offset,
        total: selectedTotal,
      },
    },
    { status: 200 }
  );
}
