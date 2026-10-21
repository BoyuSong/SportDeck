import type { Prisma } from "@/prisma/generated/index.js";
import { prisma } from "@/prisma/client";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const FETCH_MULTIPLIER = 5;

type FeedEventCreateInput = {
  actorId?: number | null;
  createdAt?: Date;
  groupKey: string;
  matchId?: number | null;
  message?: string | null;
  postId?: number | null;
  replyId?: number | null;
  teamId?: number | null;
  threadId?: number | null;
  type:
    | "FOLLOWED_USER_THREAD"
    | "FOLLOWED_USER_POST"
    | "FOLLOWED_USER_REPLY"
    | "COMMENT_ON_MY_POST"
    | "COMMENT_ON_MY_THREAD"
    | "FAVORITE_TEAM_NEW_THREAD";
  userId: number;
};

type FeedActorRecord = { avatarUrl: string | null; id: number; username: string };
type FeedThreadRecord = { id: number; title: string };
type FeedTeamRecord = { id: number; name: string; shortName: string | null };
type FavoriteTeamMatchRecord = {
  awayTeam: { name: string; shortName: string | null };
  homeTeam: { name: string; shortName: string | null };
  id: number;
  scoreAway: number | null;
  scoreHome: number | null;
  status: string;
  updatedAt: Date;
};

function uniqueUserIds(ids: Array<number | null | undefined>) {
  return [...new Set(ids.filter((id): id is number => typeof id === "number" && Number.isInteger(id) && id > 0))];
}

function buildCommentPostGroupKey(postId: number) {
  return `comment:post:${postId}`;
}

function buildCommentThreadGroupKey(threadId: number) {
  return `comment:thread:${threadId}`;
}

function buildFollowedUserGroupKey(type: "thread" | "post" | "reply", actorId: number, resourceId: number) {
  return `followed-user:${type}:${actorId}:${resourceId}`;
}

function buildFavoriteTeamThreadGroupKey(teamId: number, threadId: number) {
  return `favorite-team:thread:${teamId}:${threadId}`;
}

function buildFavoriteTeamMatchGroupKey(matchId: number) {
  return `favorite-team:match:${matchId}`;
}

function formatTeamName(team: FavoriteTeamMatchRecord["homeTeam"]) {
  return team.shortName || team.name;
}

function buildFavoriteTeamMatchSummary(match: FavoriteTeamMatchRecord) {
  const homeName = formatTeamName(match.homeTeam);
  const awayName = formatTeamName(match.awayTeam);
  const hasScore = match.scoreHome !== null || match.scoreAway !== null;

  if (hasScore) {
    return `Favorite team score update: ${homeName} ${match.scoreHome ?? "-"}-${match.scoreAway ?? "-"} ${awayName}`;
  }

  return `Favorite team match update: ${homeName} vs ${awayName}`;
}

async function getFollowerIds(tx: Prisma.TransactionClient, userId: number) {
  const followers = await tx.follow.findMany({
    where: { followingId: userId },
    select: { followerId: true },
  });

  return followers.map((row: (typeof followers)[number]) => row.followerId);
}

async function createFeedEvents(
  tx: Prisma.TransactionClient,
  events: FeedEventCreateInput[]
) {
  if (events.length === 0) {
    return;
  }

  await tx.feedEvent.createMany({
    data: events,
  });
}

export async function createFeedEventsForThreadCreation(
  tx: Prisma.TransactionClient,
  input: {
    actorId: number;
    teamId: number | null;
    threadId: number;
    title: string;
    type: "GENERAL" | "TEAM";
  }
) {
  const followerIds = await getFollowerIds(tx, input.actorId);
  const favoriteTeamUserIds =
    input.type === "TEAM" && input.teamId !== null
      ? (
          await tx.user.findMany({
            where: { favoriteTeamId: input.teamId },
            select: { id: true },
          })
        ).map((user: { id: number }) => user.id)
      : [];

  const events: FeedEventCreateInput[] = [
    ...followerIds
      .filter((userId: number) => userId !== input.actorId)
      .map((userId: number): FeedEventCreateInput => ({
        userId,
        actorId: input.actorId,
        type: "FOLLOWED_USER_THREAD",
        threadId: input.threadId,
        groupKey: buildFollowedUserGroupKey("thread", input.actorId, input.threadId),
        message: input.title,
      })),
    ...favoriteTeamUserIds
      .filter((userId: number) => userId !== input.actorId)
      .map((userId: number): FeedEventCreateInput => ({
        userId,
        actorId: input.actorId,
        type: "FAVORITE_TEAM_NEW_THREAD",
        threadId: input.threadId,
        teamId: input.teamId,
        groupKey: buildFavoriteTeamThreadGroupKey(input.teamId!, input.threadId),
        message: input.title,
      })),
  ];

  await createFeedEvents(tx, events);
}

export async function createFeedEventsForPostCreation(
  tx: Prisma.TransactionClient,
  input: {
    actorId: number;
    postId: number;
    threadId: number;
  }
) {
  const followerIds = await getFollowerIds(tx, input.actorId);

  await createFeedEvents(
    tx,
    followerIds
      .filter((userId: number) => userId !== input.actorId)
      .map((userId: number): FeedEventCreateInput => ({
        userId,
        actorId: input.actorId,
        type: "FOLLOWED_USER_POST",
        threadId: input.threadId,
        postId: input.postId,
        groupKey: buildFollowedUserGroupKey("post", input.actorId, input.postId),
      }))
  );
}

export async function createFeedEventsForReplyCreation(
  tx: Prisma.TransactionClient,
  input: {
    actorId: number;
    postAuthorId: number;
    postId: number;
    replyId: number;
    threadAuthorId: number | null;
    threadId: number;
  }
) {
  const followerIds = await getFollowerIds(tx, input.actorId);
  const targetUserIds = uniqueUserIds([input.postAuthorId, input.threadAuthorId]);

  const events: FeedEventCreateInput[] = [
    ...followerIds
      .filter((userId: number) => userId !== input.actorId)
      .map((userId: number): FeedEventCreateInput => ({
        userId,
        actorId: input.actorId,
        type: "FOLLOWED_USER_REPLY",
        threadId: input.threadId,
        postId: input.postId,
        replyId: input.replyId,
        groupKey: buildFollowedUserGroupKey("reply", input.actorId, input.replyId),
      })),
    ...targetUserIds
      .filter((userId: number) => userId !== input.actorId && userId === input.postAuthorId)
      .map((userId: number): FeedEventCreateInput => ({
        userId,
        actorId: input.actorId,
        type: "COMMENT_ON_MY_POST",
        threadId: input.threadId,
        postId: input.postId,
        replyId: input.replyId,
        groupKey: buildCommentPostGroupKey(input.postId),
      })),
    ...targetUserIds
      .filter(
        (userId: number) =>
          userId !== input.actorId &&
          userId === input.threadAuthorId &&
          userId !== input.postAuthorId
      )
      .map((userId: number): FeedEventCreateInput => ({
        userId,
        actorId: input.actorId,
        type: "COMMENT_ON_MY_THREAD",
        threadId: input.threadId,
        postId: input.postId,
        replyId: input.replyId,
        groupKey: buildCommentThreadGroupKey(input.threadId),
      })),
  ];

  await createFeedEvents(tx, events);
}

function parseLimit(rawValue: string | null) {
  if (!rawValue) {
    return DEFAULT_LIMIT;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("limit must be a positive integer");
  }

  return Math.min(parsed, MAX_LIMIT);
}

function parseCursor(rawValue: string | null) {
  if (!rawValue) {
    return null;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("cursor must be a positive integer");
  }

  return parsed;
}

type FeedEventRecord = Awaited<ReturnType<typeof prisma.feedEvent.findMany>>[number];
type GroupedEvent = {
  actorIds: number[];
  count: number;
  event: FeedEventRecord;
  kind: "event";
  latestAt: Date;
};
type GroupedFavoriteTeamMatch = {
  count: number;
  groupKey: string;
  kind: "favorite-team-match";
  latestAt: Date;
  matchId: number;
  summary: string;
  teamId: number;
};

function buildSummary(
  event: FeedEventRecord,
  count: number,
  actorNames: string[],
  threadTitles: Map<number, string>,
  teamNames: Map<number, string>
) {
  const actorLabel =
    actorNames.length === 0
      ? "Someone"
      : actorNames.length === 1
        ? actorNames[0]
        : `${actorNames[0]} and ${actorNames.length - 1} others`;

  switch (event.type) {
    case "COMMENT_ON_MY_POST":
      return count === 1 ? `${actorLabel} commented on your post` : `${count} new comments on your post`;
    case "COMMENT_ON_MY_THREAD": {
      const title = event.threadId ? threadTitles.get(event.threadId) : null;
      return title
        ? `${actorLabel} commented in your thread "${title}"`
        : `${actorLabel} commented in your thread`;
    }
    case "FOLLOWED_USER_THREAD": {
      const title = event.threadId ? threadTitles.get(event.threadId) : event.message;
      return title ? `${actorLabel} started "${title}"` : `${actorLabel} created a new thread`;
    }
    case "FOLLOWED_USER_POST":
      return `${actorLabel} posted in a discussion you may care about`;
    case "FOLLOWED_USER_REPLY":
      return `${actorLabel} replied in a discussion you may care about`;
    case "FAVORITE_TEAM_NEW_THREAD": {
      const teamName = event.teamId ? teamNames.get(event.teamId) : null;
      return teamName ? `New thread in your favorite team forum: ${teamName}` : "New thread for your favorite team";
    }
    default:
      return "New activity";
  }
}

export async function getGroupedFeedForUser(userId: number, searchParams: URLSearchParams) {
  const limit = parseLimit(searchParams.get("limit"));
  const cursor = parseCursor(searchParams.get("cursor"));

  const events = await prisma.feedEvent.findMany({
    where: {
      userId,
      ...(cursor !== null ? { id: { lt: cursor } } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit * FETCH_MULTIPLIER,
  });

  const grouped = new Map<string, GroupedEvent>();

  for (const event of events) {
    const existing = grouped.get(event.groupKey);
    if (!existing) {
      grouped.set(event.groupKey, {
        kind: "event",
        event,
        latestAt: event.createdAt,
        count: 1,
        actorIds: event.actorId ? [event.actorId] : [],
      });
      continue;
    }

    existing.count += 1;
    if (event.actorId && !existing.actorIds.includes(event.actorId)) {
      existing.actorIds.push(event.actorId);
    }
    if (event.createdAt > existing.latestAt) {
      existing.latestAt = event.createdAt;
      existing.event = event;
    }
  }

  const groups = Array.from(grouped.values())
    .sort((a, b) => {
      const timeDiff = b.latestAt.getTime() - a.latestAt.getTime();
      if (timeDiff !== 0) return timeDiff;
      return b.event.id - a.event.id;
    })
    .slice(0, limit);

  let favoriteTeamMatchGroups: GroupedFavoriteTeamMatch[] = [];

  if (cursor === null) {
    const viewer = await prisma.user.findUnique({
      where: { id: userId },
      select: { favoriteTeamId: true },
    });

    if (viewer?.favoriteTeamId) {
      const recentWindow = new Date();
      recentWindow.setDate(recentWindow.getDate() - 14);

      const matchUpdates = await prisma.match.findMany({
        where: {
          updatedAt: { gte: recentWindow },
          OR: [
            { homeTeamId: viewer.favoriteTeamId },
            { awayTeamId: viewer.favoriteTeamId },
          ],
          AND: [
            {
              OR: [
                { scoreHome: { not: null } },
                { scoreAway: { not: null } },
                {
                  status: {
                    in: ["FINISHED", "IN_PLAY", "PAUSED"],
                  },
                },
              ],
            },
          ],
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: 3,
        select: {
          id: true,
          status: true,
          updatedAt: true,
          scoreHome: true,
          scoreAway: true,
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

      favoriteTeamMatchGroups = matchUpdates.map((match) => ({
        kind: "favorite-team-match",
        count: 1,
        latestAt: match.updatedAt,
        matchId: match.id,
        teamId: viewer.favoriteTeamId!,
        groupKey: buildFavoriteTeamMatchGroupKey(match.id),
        summary: buildFavoriteTeamMatchSummary(match),
      }));
    }
  }

  const combinedGroups = [...groups, ...favoriteTeamMatchGroups].sort((a, b) => {
    const timeDiff = b.latestAt.getTime() - a.latestAt.getTime();
    if (timeDiff !== 0) return timeDiff;
    if (a.kind === "event" && b.kind === "event") {
      return b.event.id - a.event.id;
    }
    if (a.kind === "favorite-team-match" && b.kind === "favorite-team-match") {
      return b.matchId - a.matchId;
    }
    return a.kind === "favorite-team-match" ? 1 : -1;
  });

  const actorIds = uniqueUserIds(
    combinedGroups.flatMap((group) => (group.kind === "event" ? group.actorIds : []))
  );
  const threadIds = uniqueUserIds(
    combinedGroups.map((group) =>
      group.kind === "event" ? group.event.threadId ?? null : null
    )
  );
  const teamIds = uniqueUserIds(
    combinedGroups.map((group) =>
      group.kind === "event" ? group.event.teamId ?? null : group.teamId
    )
  );
  const groupKeys = combinedGroups.map((group) =>
    group.kind === "event" ? group.event.groupKey : group.groupKey
  );

  const [actors, threads, teams, readStates] = await Promise.all([
    actorIds.length > 0
      ? prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, username: true, avatarUrl: true },
        })
      : ([] as FeedActorRecord[]),
    threadIds.length > 0
      ? prisma.thread.findMany({
          where: { id: { in: threadIds } },
          select: { id: true, title: true },
        })
      : ([] as FeedThreadRecord[]),
    teamIds.length > 0
      ? prisma.team.findMany({
          where: { id: { in: teamIds } },
          select: { id: true, name: true, shortName: true },
        })
      : ([] as FeedTeamRecord[]),
    groupKeys.length > 0
      ? prisma.$queryRawUnsafe<Array<{ groupKey: string; lastReadAt: Date | null }>>(
          `SELECT "groupKey", "lastReadAt"
           FROM "FeedGroupState"
           WHERE "userId" = $1
             AND "groupKey" = ANY($2)`,
          userId,
          groupKeys
        )
      : [],
  ]);

  const actorMap = new Map<number, FeedActorRecord>(actors.map((actor: FeedActorRecord) => [actor.id, actor]));
  const threadTitleMap = new Map<number, string>(threads.map((thread: FeedThreadRecord) => [thread.id, thread.title]));
  const teamNameMap = new Map<number, string>(
    teams.map((team: FeedTeamRecord) => [team.id, team.shortName || team.name])
  );
  const readStateMap = new Map<string, Date | null>(
    readStates.map((state: (typeof readStates)[number]) => [state.groupKey, state.lastReadAt])
  );

  const items = combinedGroups.map((group) => {
    if (group.kind === "favorite-team-match") {
      return {
        id: group.matchId * -1,
        groupKey: group.groupKey,
        type: "FAVORITE_TEAM_MATCH_UPDATE" as const,
        count: group.count,
        latestAt: group.latestAt,
        isRead: Boolean(readStateMap.get(group.groupKey)),
        lastReadAt: readStateMap.get(group.groupKey),
        actorIds: [],
        actors: [],
        threadId: null,
        postId: null,
        replyId: null,
        teamId: group.teamId,
        matchId: group.matchId,
        summary: group.summary,
      };
    }

    const actorRecords = group.actorIds
      .map((actorId: number) => actorMap.get(actorId))
      .filter((actor): actor is FeedActorRecord => Boolean(actor))
      .slice(0, 3);

    return {
      id: group.event.id,
      groupKey: group.event.groupKey,
      type: group.event.type,
      count: group.count,
      latestAt: group.latestAt,
      isRead: Boolean(readStateMap.get(group.event.groupKey)),
      lastReadAt: readStateMap.get(group.event.groupKey),
      actorIds: group.actorIds,
      actors: actorRecords,
      threadId: group.event.threadId,
      postId: group.event.postId,
      replyId: group.event.replyId,
      teamId: group.event.teamId,
      matchId: group.event.matchId,
      summary: buildSummary(
        group.event,
        group.count,
        actorRecords.map((actor: FeedActorRecord) => actor.username),
        threadTitleMap,
        teamNameMap
      ),
    };
  });

  const nextCursor = events.length === limit * FETCH_MULTIPLIER ? events[events.length - 1]?.id ?? null : null;

  return {
    items,
    nextCursor,
    pagination: {
      limit,
      rawEventCount: events.length,
    },
  };
}

export async function markFeedGroupAsRead(userId: number, groupKey: string) {
  const normalized = groupKey.trim();
  if (!normalized) {
    throw new Error("groupKey is required");
  }

  const lastReadAt = new Date();

  await prisma.$executeRawUnsafe(
    `INSERT INTO "FeedGroupState" ("userId", "groupKey", "lastReadAt", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT ("userId", "groupKey")
     DO UPDATE
     SET "lastReadAt" = EXCLUDED."lastReadAt",
         "archivedAt" = NULL,
         "updatedAt" = EXCLUDED."updatedAt"`,
    userId,
    normalized,
    lastReadAt,
    lastReadAt,
    lastReadAt
  );

  return {
    groupKey: normalized,
    lastReadAt,
  };
}
