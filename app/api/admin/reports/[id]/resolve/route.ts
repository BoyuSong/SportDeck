// approve/dismiss a report POST
import type { Prisma } from "@/prisma/generated/index.js";
import { NextResponse } from "next/server";
import { prisma } from "@/prisma/client";
import { withAuth } from "@/utils/auth";
export const dynamic = "force-dynamic";


export const POST = withAuth(
  async (request, payload, { params }) => {
    const { id } = await params;
    const reportId = Number(id);
    if (Number.isNaN(reportId)) {
      return NextResponse.json({ error: "Invalid report id" }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const action = String(body.action ?? "").toUpperCase();
    const note = body.note ? String(body.note) : null;
    const banUser = Boolean(body.banUser);

    if (!["APPROVE", "DISMISS"].includes(action)) {
      return NextResponse.json(
        { error: "action must be APPROVE or DISMISS" },
        { status: 400 }
      );
    }

    const report = await prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    if (report.status !== "OPEN") {
      return NextResponse.json(
        { error: "Only OPEN reports can be resolved" },
        { status: 409 }
      );
    }

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const relatedWhere = report.threadId
        ? { threadId: report.threadId, status: "OPEN" as const }
        : report.postId
          ? { postId: report.postId, status: "OPEN" as const }
          : { replyId: report.replyId, status: "OPEN" as const };

      const relatedReports = await tx.report.findMany({
        where: relatedWhere,
        select: { id: true },
      });

      let updatedReport;
      let moderatedTarget = null;
      let bannedUser = null;

      if (action === "DISMISS") {
        await tx.report.updateMany({
          where: relatedWhere,
          data: { status: "DISMISSED" },
        });
        updatedReport = { ...report, status: "DISMISSED" };

        await tx.moderationAction.createMany({
          data: relatedReports.map((item) => ({
            reportId: item.id,
            adminId: payload.userId,
            action: "DISMISS",
            note,
          })),
        });

        return { updatedReport, moderatedTarget, bannedUser };
      }

      await tx.report.updateMany({
        where: relatedWhere,
        data: { status: "APPROVED" },
      });
      updatedReport = { ...report, status: "APPROVED" };

      if (report.threadId) {
        // hide thread
        moderatedTarget = await tx.thread.update({
          where: { id: report.threadId },
          data: { status: "HIDDEN" },
        });

        if (banUser) {
          const thread = await tx.thread.findUnique({
            where: { id: report.threadId },
            select: { authorId: true },
          });

          if (thread?.authorId) {
            bannedUser = await tx.user.update({
              where: { id: thread.authorId },
              data: {
                banStatus: "BANNED",
                banReason: note ?? "Banned due to approved report",
                bannedAt: new Date(),
              },
            });
          }
        }
      } else if (report.postId) {
        moderatedTarget = await tx.post.update({
          where: { id: report.postId },
          data: { status: "HIDDEN" },
        });

        if (banUser) {
          const post = await tx.post.findUnique({
            where: { id: report.postId },
            select: { authorId: true },
          });

          if (post?.authorId) {
            bannedUser = await tx.user.update({
              where: { id: post.authorId },
              data: {
                banStatus: "BANNED",
                banReason: note ?? "Banned due to approved report",
                bannedAt: new Date(),
              },
            });
          }
        }
      } else if (report.replyId) {
        moderatedTarget = await tx.reply.update({
          where: { id: report.replyId },
          data: { status: "HIDDEN" },
        });

        if (banUser) {
          const reply = await tx.reply.findUnique({
            where: { id: report.replyId },
            select: { authorId: true },
          });

          if (reply?.authorId) {
            bannedUser = await tx.user.update({
              where: { id: reply.authorId },
              data: {
                banStatus: "BANNED",
                banReason: note ?? "Banned due to approved report",
                bannedAt: new Date(),
              },
            });
          }
        }
      }

      await tx.moderationAction.createMany({
        data: relatedReports.map((item) => ({
          reportId: item.id,
          adminId: payload.userId,
          action: banUser ? "APPROVE_AND_BAN" : "APPROVE",
          note,
        })),
      });

      return { updatedReport, moderatedTarget, bannedUser };
    });

    return NextResponse.json(
      {
        message: action === "DISMISS" ? "Report dismissed" : "Report approved",
        report: result.updatedReport,
        target: result.moderatedTarget,
        bannedUser: result.bannedUser
          ? {
              id: result.bannedUser.id,
              username: result.bannedUser.username,
              banStatus: result.bannedUser.banStatus,
            }
          : null,
      },
      { status: 200 }
    );
  },
  { requireRole: "ADMIN", checkBan: true}
);
