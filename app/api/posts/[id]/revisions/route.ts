import { NextResponse } from "next/server";
import { prisma } from "@/prisma/client";
import { type IdRouteContext, parseRequiredInt, jsonError } from "@/utils/forum";

export const dynamic = "force-dynamic";

async function parsePostId(params: IdRouteContext["params"]) {
  const { id } = await params;
  return parseRequiredInt(id, "post id");
}

export async function GET(_request: Request, { params }: IdRouteContext) {
  try {
    const postId = await parsePostId(params);

    const post = await prisma.post.findUnique({
      where: { id: postId },
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

    if (!post || post.status === "HIDDEN") {
      return jsonError("Post not found", 404);
    }

    return NextResponse.json(
      {
        postId: post.id,
        currentBody: post.body,
        previousVersionCount: post.revisions.length,
        revisions: post.revisions.map((revision: (typeof post.revisions)[number]) => ({
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
