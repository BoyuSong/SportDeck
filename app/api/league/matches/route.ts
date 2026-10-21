import { NextResponse, type NextRequest } from "next/server";
import type { Prisma } from "@/prisma/generated/index.js";
import { prisma } from "@/prisma/client";
import { getOrSetJson } from "@/utils/cache";

export const dynamic = "force-dynamic";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;
const WINDOW_VALUES = new Set(["all", "upcoming", "recent"] as const);
type WindowValue = "all" | "recent" | "upcoming";
type MatchRecord = {
  awayTeam: {
    crestUrl: string | null;
    id: number;
    name: string;
    shortName: string | null;
  };
  externalId: number;
  homeTeam: {
    crestUrl: string | null;
    id: number;
    name: string;
    shortName: string | null;
  };
  id: number;
  matchday: number | null;
  scoreAway: number | null;
  scoreHome: number | null;
  stage: string | null;
  status: string;
  utcDate: Date;
  venue: string | null;
};

type MatchThreadRecord = {
  id: number;
  matchId: number | null;
};

type MatchFilterRow = {
  matchday: number | null;
  stage: string | null;
};

function parsePositiveInt(value: string | null, fieldName: string) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
  return parsed;
}

function parseNonNegativeInt(value: string | null, fieldName: string) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a non-negative integer`);
  }
  return parsed;
}

function normalizeWindow(value: string | null): WindowValue {
  if (!value) return "all";
  const normalized = String(value).toLowerCase();
  if (!WINDOW_VALUES.has(normalized as WindowValue)) {
    throw new Error("window must be one of: all, upcoming, recent");
  }
  return normalized as WindowValue;
}

function buildWhereClause({
  matchday,
  stage,
  window,
}: {
  matchday: number | null;
  stage: string | null;
  window: WindowValue;
}) {
  const where: Prisma.MatchWhereInput = {};

  if (matchday !== null) {
    where.matchday = matchday;
  }

  if (stage) {
    where.stage = stage;
  }

  // Time window is derived from current server time.
  const now = new Date();
  if (window === "upcoming") {
    where.utcDate = { gte: now };
  } else if (window === "recent") {
    where.utcDate = { lte: now };
  }

  return where;
}

// Shape DB records into API response objects used by the frontend.
function mapMatch(match: MatchRecord, threadIdByMatchId: Map<number, number>) {
  return {
    id: match.id,
    externalId: match.externalId,
    status: match.status,
    matchday: match.matchday,
    stage: match.stage,
    threadId: threadIdByMatchId.get(match.id) ?? null,
    utcDate: match.utcDate,
    venue: match.venue,
    homeTeam: {
      id: match.homeTeam.id,
      name: match.homeTeam.name,
      shortName: match.homeTeam.shortName,
      crestUrl: match.homeTeam.crestUrl,
      score: match.scoreHome,
    },
    awayTeam: {
      id: match.awayTeam.id,
      name: match.awayTeam.name,
      shortName: match.awayTeam.shortName,
      crestUrl: match.awayTeam.crestUrl,
      score: match.scoreAway,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Visitor-facing filters:
    // window=all|upcoming|recent, optional matchday/stage, optional limit.
    const window = normalizeWindow(searchParams.get("window"));
    const matchday = parsePositiveInt(searchParams.get("matchday"), "matchday");

    let limit = parsePositiveInt(searchParams.get("limit"), "limit") ?? DEFAULT_LIMIT;
    limit = Math.min(limit, MAX_LIMIT);
    const offset = parseNonNegativeInt(searchParams.get("offset"), "offset") ?? 0;

    const stageRaw = searchParams.get("stage");
    const stage = stageRaw && stageRaw.trim() !== "" ? stageRaw.trim() : null;

    const where = buildWhereClause({ window, matchday, stage });
    const cacheKey = [
      "league:matches:v1",
      `window=${window}`,
      `matchday=${matchday ?? "all"}`,
      `stage=${stage ?? "all"}`,
      `limit=${limit}`,
      `offset=${offset}`,
    ].join(":");

    const orderBy: Prisma.MatchOrderByWithRelationInput = {
      // Upcoming list should be soonest first; recent list should be latest first.
      utcDate: window === "upcoming" ? "asc" : "desc",
    };

    const { status, value } = await getOrSetJson(cacheKey, async () => {
      const [matches, total, filterRows, matchThreads] = await Promise.all([
        prisma.match.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy,
          select: {
            id: true,
            externalId: true,
            status: true,
            matchday: true,
            stage: true,
            utcDate: true,
            venue: true,
            scoreHome: true,
            scoreAway: true,
            homeTeam: {
              select: {
                id: true,
                name: true,
                shortName: true,
                crestUrl: true,
              },
            },
            awayTeam: {
              select: {
                id: true,
                name: true,
                shortName: true,
                crestUrl: true,
              },
            },
          },
        }),
        prisma.match.count({ where }),
        // Build browse metadata from all stored matches.
        prisma.match.findMany({
          select: {
            matchday: true,
            stage: true,
          },
        }),
        prisma.thread.findMany({
          where: {
            type: "MATCH",
            status: "VISIBLE",
            matchId: {
              not: null,
            },
          },
          select: {
            id: true,
            matchId: true,
          },
        }),
      ]);

      const threadIdByMatchId = new Map<number, number>(
        matchThreads
          .filter(
            (thread: MatchThreadRecord): thread is MatchThreadRecord & { matchId: number } =>
              thread.matchId !== null
          )
          .map((thread: MatchThreadRecord & { matchId: number }) => [thread.matchId, thread.id])
      );

      const availableMatchdays = Array.from(
        new Set<number>(
          filterRows
            .map((row: MatchFilterRow) => row.matchday)
            .filter((v: number | null): v is number => v !== null)
        )
      ).sort((a: number, b: number) => a - b);
      const availableStages = Array.from(
        new Set<string>(
          filterRows
            .map((row: MatchFilterRow) => row.stage)
            .filter((stageValue: string | null): stageValue is string => Boolean(stageValue))
        )
      ).sort();

      return {
        filters: {
          applied: { window, matchday, stage, limit },
          available: {
            matchdays: availableMatchdays,
            stages: availableStages,
          },
        },
        pagination: {
          limit,
          offset,
          total,
        },
        total,
        matches: matches.map((match: MatchRecord) => mapMatch(match, threadIdByMatchId)),
      };
    });

    return NextResponse.json(value, {
      status: 200,
      headers: { "X-Cache": status },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("must be")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
