//ban an user POST
import { NextResponse } from "next/server";
import { prisma } from "@/prisma/client";
import { withAuth } from "@/utils/auth";
export const dynamic = "force-dynamic";


export const POST = withAuth(
  async (request, payload, { params }) => {
    const { id } = await params;
    const userId = Number(id);

    if (Number.isNaN(userId)) {
      return NextResponse.json(
        { error: "Invalid user id" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => null);
    const reason = String(body?.reason ?? "").trim();

    if (!reason) {
      return NextResponse.json(
        { error: "reason is required" },
        { status: 400 }
      );
    }

    if (userId === payload.userId) {
      return NextResponse.json(
        { error: "Admins cannot ban themselves" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        banStatus: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    if (user.banStatus === "BANNED") {
      return NextResponse.json(
        { error: "User is already banned" },
        { status: 409 }
      );
    }

    const bannedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        banStatus: "BANNED",
        banReason: reason,
        bannedAt: new Date(),
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        banStatus: true,
        banReason: true,
        bannedAt: true,
      },
    });

    return NextResponse.json(
      {
        message: "User banned successfully",
        user: bannedUser,
      },
      { status: 200 }
    );
  },
  { requireRole: "ADMIN", checkBan: true }
);
