import type { IdRouteContext } from "@/utils/forum";
import type { Prisma } from "@/prisma/generated/index.js";
import { NextResponse } from "next/server";
import { prisma } from "@/prisma/client";
import { withAuth } from "@/utils/auth";

export const dynamic = "force-dynamic";

export const POST = withAuth(
  async (request, _payload, { params }: IdRouteContext) => {
    const { id } = await params;
    const appealId = Number(id);
    if (Number.isNaN(appealId)) {
      return NextResponse.json({ error: "Invalid appeal id" }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const action = String(body.action ?? "").toUpperCase();

    if (!["APPROVE", "REJECT"].includes(action)) {
      return NextResponse.json(
        { error: "action must be APPROVE or REJECT" },
        { status: 400 }
      );
    }

    const appeal = await prisma.appeal.findUnique({
      where: { id: appealId },
      include: {
        user: true,
      },
    });

    if (!appeal) {
      return NextResponse.json({ error: "Appeal not found" }, { status: 404 });
    }

    if (appeal.status !== "OPEN") {
      return NextResponse.json(
        { error: "Only OPEN appeals can be resolved" },
        { status: 409 }
      );
    }

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      let updatedUser = null;

      const updatedAppeal = await tx.appeal.update({
        where: { id: appealId },
        data: {
          status: action === "APPROVE" ? "APPROVED" : "REJECTED",
        },
      });

      if (action === "APPROVE") {
        updatedUser = await tx.user.update({
          where: { id: appeal.userId },
          data: {
            banStatus: "NOT_BANNED",
            banReason: null,
            bannedAt: null,
          },
        });
      }

      return { updatedAppeal, updatedUser };
    });

    return NextResponse.json(
      {
        message: action === "APPROVE" ? "Appeal approved and user unbanned" : "Appeal rejected",
        appeal: result.updatedAppeal,
        user: result.updatedUser
          ? {
              id: result.updatedUser.id,
              username: result.updatedUser.username,
              banStatus: result.updatedUser.banStatus,
            }
          : null,
      },
      { status: 200 }
    );
  },
  { requireRole: "ADMIN" }
);
