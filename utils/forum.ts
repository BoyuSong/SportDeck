import { NextResponse } from "next/server";
import { prisma } from "@/prisma/client";
import type {
  ContentStatus,
  Prisma,
  ThreadType,
} from "@/prisma/generated/index.js";
import type { AuthTokenPayload } from "@/utils/auth";

export const MATCH_THREAD_OPEN_DAYS = 14;
export const MATCH_THREAD_CLOSE_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

type TagEntry = {
  tag?: {
    name?: string | null;
  } | null;
};

type MatchThreadShape = {
  awayTeam: {
    name: string;
    shortName: string | null;
  };
  homeTeam: {
    name: string;
    shortName: string | null;
  };
  matchday: number | null;
};

type ThreadWindowShape = {
  closeAt: Date | null;
  openAt: Date | null;
  status: ContentStatus;
  type: ThreadType;
};

type ContentStatusShape = {
  status: ContentStatus;
};

export type IdRouteContext = {
  params: Promise<{ id: string }>;
};

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function parseOptionalInt(value: string | null | undefined, fieldName: string) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
  return parsed;
}

export function parseRequiredInt(value: string | number, fieldName: string) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
  return parsed;
}

export function parseOptionalBoolean(
  value: string | null | undefined,
  defaultValue = false
) {
  if (value === null || value === undefined || value === "") {
    return defaultValue;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes"].includes(normalized)) return true;
  if (["0", "false", "no"].includes(normalized)) return false;
  throw new Error("Boolean query parameter must be true/false");
}

export function parseOptionalDate(
  value: string | number | Date | null | undefined,
  fieldName: string
) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} must be a valid date string`);
  }
  return parsed;
}

export function normalizeTagNames(rawTags: unknown): string[] {
  if (!Array.isArray(rawTags)) return [];

  const deduped = new Set<string>();
  for (const rawTag of rawTags) {
    if (typeof rawTag !== "string") continue;
    const normalized = rawTag.trim().toLowerCase();
    if (!normalized) continue;
    deduped.add(normalized);
  }
  return [...deduped];
}

export function buildTagCreateInput(tagNames: string[]) {
  return tagNames.map(
    (name): Prisma.ThreadTagCreateWithoutThreadInput => ({
      tag: {
        connectOrCreate: {
          where: { name },
          create: { name },
        },
      },
    })
  );
}

export function mapTagNames(thread?: { tags?: TagEntry[] | null } | null): string[] {
  if (!thread?.tags) {
    return [];
  }

  return thread.tags
    .map((entry) => entry.tag?.name)
    .filter((name): name is string => Boolean(name));
}

export function computeMatchThreadWindow(utcDate: Date | string) {
  const kickoff = new Date(utcDate);
  return {
    openAt: new Date(kickoff.getTime() - MATCH_THREAD_OPEN_DAYS * DAY_MS),
    closeAt: new Date(kickoff.getTime() + MATCH_THREAD_CLOSE_DAYS * DAY_MS),
  };
}

function getTeamLabel(team: MatchThreadShape["homeTeam"]) {
  return team.shortName || team.name;
}

export function buildMatchThreadTitle(match: MatchThreadShape) {
  const home = getTeamLabel(match.homeTeam);
  const away = getTeamLabel(match.awayTeam);
  const dayPart = Number.isInteger(match.matchday)
    ? ` - Matchday ${match.matchday}`
    : "";
  return `${home} vs ${away}${dayPart}`;
}

export async function ensureAutoMatchThreads(): Promise<void> {
  const now = Date.now();
  const openLimit = new Date(now + MATCH_THREAD_OPEN_DAYS * DAY_MS);

  const matches = await prisma.match.findMany({
    where: {
      utcDate: { lte: openLimit },
    },
    select: {
      id: true,
      utcDate: true,
      matchday: true,
      homeTeam: {
        select: {
          name: true,
          shortName: true,
        },
      },
      awayTeam: {
        select: {
          name: true,
          shortName: true,
        },
      },
    },
  });

  for (const match of matches) {
    const { openAt, closeAt } = computeMatchThreadWindow(match.utcDate);
    const title = buildMatchThreadTitle(match);

    await prisma.thread.upsert({
      where: { matchId: match.id },
      update: {
        title,
        openAt,
        closeAt,
      },
      create: {
        type: "MATCH",
        title,
        matchId: match.id,
        openAt,
        closeAt,
      },
    });
  }
}

export function isThreadVisibleForReading(thread: ThreadWindowShape, now = new Date()) {
  if (thread.status === "HIDDEN") return false;

  if (thread.type === "MATCH" && thread.openAt && now < new Date(thread.openAt)) {
    return false;
  }

  return true;
}

export function isThreadOpenForPosting(thread: ThreadWindowShape, now = new Date()) {
  if (thread.status === "HIDDEN" || thread.status === "LOCKED") {
    return false;
  }

  if (thread.type !== "MATCH") return true;

  if (thread.openAt && now < new Date(thread.openAt)) return false;
  if (thread.closeAt && now > new Date(thread.closeAt)) return false;
  return true;
}

export function isContentWritable(content: ContentStatusShape) {
  return content.status === "VISIBLE";
}

export function canManageResource(payload: AuthTokenPayload, authorId: number) {
  return payload.role === "ADMIN" || payload.userId === authorId;
}

export async function getThreadForWrite(threadId: number) {
  return prisma.thread.findUnique({
    where: { id: threadId },
    select: {
      id: true,
      type: true,
      status: true,
      openAt: true,
      closeAt: true,
    },
  });
}
