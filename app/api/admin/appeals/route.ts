import { NextResponse } from "next/server";
import { prisma } from "@/prisma/client";
import { withAuth } from "@/utils/auth";

export const dynamic = "force-dynamic";

export const GET = withAuth(
  async (request) => {
    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get("limit") ?? "20");
    const offsetParam = Number(searchParams.get("offset") ?? "0");
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(Math.trunc(limitParam), 1), 100)
      : 20;
    const offset = Number.isFinite(offsetParam)
      ? Math.max(Math.trunc(offsetParam), 0)
      : 0;

    const appeals = await prisma.appeal.findMany({
      where: {
        status: "OPEN",
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            banStatus: true,
            banReason: true,
            bannedAt: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip: offset,
      take: limit,
    });

    const total = await prisma.appeal.count({
      where: {
        status: "OPEN",
      },
    });

    return NextResponse.json(
      {
        items: appeals,
        pagination: {
          limit,
          offset,
          total,
        },
      },
      { status: 200 }
    );
  },
  { requireRole: "ADMIN" }
);
