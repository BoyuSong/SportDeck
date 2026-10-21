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

  const following = await prisma.follow.findMany({
    where: {
      followerId: payload.userId,
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
      followerId: payload.userId,
    },
  });

  return NextResponse.json(
    {
      items: following.map((f: (typeof following)[number]) => ({
        followedAt: f.createdAt,
        user: f.following,
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
