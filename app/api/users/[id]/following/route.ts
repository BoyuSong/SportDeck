import { NextResponse } from "next/server";
import { prisma } from "@/prisma/client";
import type { IdRouteContext } from "@/utils/forum";

export async function GET(request: Request, { params }: IdRouteContext) {
  const { id } = await params;
  const userId = Number(id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const requestUrl = new URL(request.url);
  const limitParam = Number(requestUrl.searchParams.get("limit") ?? "20");
  const offsetParam = Number(requestUrl.searchParams.get("offset") ?? "0");
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(Math.trunc(limitParam), 1), 100)
    : 20;
  const offset = Number.isFinite(offsetParam)
    ? Math.max(Math.trunc(offsetParam), 0)
    : 0;

  const following = await prisma.follow.findMany({
    where: {
      followerId: userId,
    },
    include: {
      following: {
        select: {
          id: true,
          username: true,
          avatarUrl: true,
          favoriteTeamId: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    skip: offset,
    take: limit,
  });

  const total = await prisma.follow.count({
    where: {
      followerId: userId,
    },
  });

  return NextResponse.json(
    {
      items: following.map((entry) => ({
        followedAt: entry.createdAt,
        user: entry.following,
      })),
      pagination: {
        limit,
        offset,
        total,
      },
    },
    { status: 200 }
  );
}
