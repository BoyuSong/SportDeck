import { NextResponse } from "next/server";
import { prisma } from "@/prisma/client";
import { type IdRouteContext, parseRequiredInt, jsonError } from "@/utils/forum";

export const dynamic = "force-dynamic";

async function parseReplyId(params: IdRouteContext["params"]) {
  const { id } = await params;
  return parseRequiredInt(id, "reply id");
}

export async function GET(_request: Request, { params }: IdRouteContext) {
  try {
    const replyId = await parseReplyId(params);

    const reply = await prisma.reply.findUnique({
      where: { id: replyId },
      select: {
        id: true,
        status: true,
        body: true,
        revisions: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            body: true,
            createdAt: true,
            editor: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
    });

    if (!reply || reply.status === "HIDDEN") {
      return jsonError("Reply not found", 404);
    }

    return NextResponse.json(
      {
        replyId: reply.id,
        currentBody: reply.body,
        previousVersionCount: reply.revisions.length,
        revisions: reply.revisions.map((revision: (typeof reply.revisions)[number]) => ({
          ...revision,
          previousBody: revision.body,
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("positive integer")) {
      return jsonError(error.message, 400);
    }
    console.error(error);
    return jsonError("Internal server error", 500);
  }
}
