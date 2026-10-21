import { NextResponse } from "next/server";
import { withAuth } from "@/utils/auth";
import { prisma } from "@/prisma/client";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (_request, payload) => {
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      username: true,
      avatarUrl: true,
      favoriteTeamId: true,
      role: true,
      banStatus: true,
      banReason: true,
      bannedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user }, { status: 200 });
});
