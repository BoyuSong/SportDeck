//As a user, I want to see an overall sentiment indicator on match threads, showing the collective mood (e.g., positive, negative, mixed) based on AI analysis of all comments
// GET
import { NextResponse } from "next/server";
import { prisma } from "@/prisma/client";
import type { IdRouteContext } from "@/utils/forum";
export const dynamic = "force-dynamic";


export async function GET(_request: Request, { params }: IdRouteContext) {
  const { id } = await params;
  const threadId = Number(id);

  const thread = await prisma.thread.findUnique({
    where: { id: threadId },
    include: {
      match: true,
      posts: {
        where: { status: "VISIBLE" },
        include: {
          author: {
            select: {
              favoriteTeamId: true,
            },
          },
          replies: {
            where: { status: "VISIBLE" },
            include: {
              author: {
                select: {
                  favoriteTeamId: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }
  console.log(thread.id, thread.type, thread.matchId, thread.match);
  if (!thread.match) {
    return NextResponse.json(
      { error: "Sentiment breakdown is only supported for match threads" },
      { status: 400 }
    );
  }

  const allScores: number[] = [];
  const homeScores: number[] = [];
  const awayScores: number[] = [];

  for (const post of thread.posts) {
    if (typeof post.sentimentScore === "number") {
      allScores.push(post.sentimentScore);

      if (post.author?.favoriteTeamId === thread.match.homeTeamId) {
        homeScores.push(post.sentimentScore);
      }
      if (post.author?.favoriteTeamId === thread.match.awayTeamId) {
        awayScores.push(post.sentimentScore);
      }
    }

    for (const reply of post.replies) {
      if (typeof reply.sentimentScore === "number") {
        allScores.push(reply.sentimentScore);

        if (reply.author?.favoriteTeamId === thread.match.homeTeamId) {
          homeScores.push(reply.sentimentScore);
        }
        if (reply.author?.favoriteTeamId === thread.match.awayTeamId) {
          awayScores.push(reply.sentimentScore);
        }
      }
    }
  }

  const overallAvg = average(allScores);
  const homeAvg = average(homeScores);
  const awayAvg = average(awayScores);

  return NextResponse.json({
    overall: avgToMood(overallAvg),
    homeTeam: avgToMood(homeAvg),
    awayTeam: avgToMood(awayAvg),
    overallScore: overallAvg,
    homeTeamScore: homeAvg,
    awayTeamScore: awayAvg,
    commentCount: allScores.length,
    homeFanCommentCount: homeScores.length,
    awayFanCommentCount: awayScores.length,
  });
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function avgToMood(avg: number) {
  if (avg > 0.25) return "positive";
  if (avg < -0.25) return "negative";
  return "mixed";
}
