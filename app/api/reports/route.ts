// report a user POST
import { NextResponse } from "next/server";
import { prisma } from "@/prisma/client";
import { withAuth } from "@/utils/auth";
export const dynamic = "force-dynamic";


type ReportTarget =
  | { id: number; kind: "post" }
  | { id: number; kind: "reply" }
  | { id: number; kind: "thread" };

function pickTarget(body: Record<string, unknown>): ReportTarget | null { //get the target type from the request body
  const candidates = [
    body.threadId ? ({ kind: "thread", id: Number(body.threadId) } as const) : null,
    body.postId ? ({ kind: "post", id: Number(body.postId) } as const) : null,
    body.replyId ? ({ kind: "reply", id: Number(body.replyId) } as const) : null,
  ].filter(Boolean);

  return candidates.length === 1 ? candidates[0] : null;// only one of the 3 types above
}

export const POST = withAuth(async (request, payload) => {
  const reporterId = payload.userId;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const reason = String(body.reason ?? "").trim();
  if (!reason) return NextResponse.json({ error: "reason is required" }, { status: 400 });

  const target = pickTarget(body);
  if (!target) {
    return NextResponse.json(
      { error: "Provide exactly one of threadId, postId, replyId" },
      { status: 400 }
    );
  }

  // Ensure the target exists
  let targetText = "";
  if (target.kind === "thread") {
    const t = await prisma.thread.findUnique({ where: { id: target.id } });
    if (!t) return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    targetText = t.title;
  } else if (target.kind === "post") {
    const p = await prisma.post.findUnique({ where: { id: target.id } });
    if (!p) return NextResponse.json({ error: "Post not found" }, { status: 404 });
    targetText = p.body;
  } else {
    const r = await prisma.reply.findUnique({ where: { id: target.id } });
    if (!r) return NextResponse.json({ error: "Reply not found" }, { status: 404 });
    targetText = r.body;
  }

  // Prevent repeated reports on the same object
  const existing = await prisma.report.findFirst({
    where: {
      reporterId,
      status: "OPEN",
      threadId: target.kind === "thread" ? target.id : null,
      postId: target.kind === "post" ? target.id : null,
      replyId: target.kind === "reply" ? target.id : null,
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "You already reported this content (open report exists).", reportId: existing.id },
      { status: 409 }
    );
  }

  // Start creating a report
  const report = await prisma.report.create({
    data: {
      reporterId,
      reason,
      status: "OPEN",
      threadId: target.kind === "thread" ? target.id : null,
      postId: target.kind === "post" ? target.id : null,
      replyId: target.kind === "reply" ? target.id : null,
    },
  });

  return NextResponse.json(report, { status: 201 });
}, { checkBan: true });
