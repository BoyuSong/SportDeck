import { NextResponse } from "next/server";
import { prisma } from "@/prisma/client";
import { withAuth } from "@/utils/auth";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (request, payload) => {
  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit") ?? "20");
  const offsetParam = Number(searchParams.get("offset") ?? "0");
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(Math.trunc(limitParam), 1), 100)
    : 20;
  const offset = Number.isFinite(offsetParam)
    ? Math.max(Math.trunc(offsetParam), 0)
    : 0;

  const followers = await prisma.follow.findMany({
    where: {
      followingId: payload.userId,
    },
    include: {
      follower: {
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
      followingId: payload.userId,
    },
  });

  return NextResponse.json(
    {
      items: followers.map((f: (typeof followers)[number]) => ({
        followedAt: f.createdAt,
        user: f.follower,
      })),
      pagination: {
        limit,
        offset,
        total,
      },
    },
    { status: 200 }
  );
});
