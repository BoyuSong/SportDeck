import bcrypt from "bcrypt";
import { PrismaClient } from "../prisma/generated/index.js";

const prisma = new PrismaClient();

const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? "sportsdeck-demo";
const FALLBACK_TEAMS = [
  {
    crestUrl: null,
    externalId: 990001,
    name: "Northbridge FC",
    shortName: "NBR",
    venue: "Northbridge Park",
  },
  {
    crestUrl: null,
    externalId: 990002,
    name: "Harbor City",
    shortName: "HBC",
    venue: "Harbor Ground",
  },
  {
    crestUrl: null,
    externalId: 990003,
    name: "Kingsley United",
    shortName: "KNG",
    venue: "Kingsley Arena",
  },
  {
    crestUrl: null,
    externalId: 990004,
    name: "Maple Athletic",
    shortName: "MAP",
    venue: "Maple Square",
  },
];

const SHOWCASE_MATCH_DEFINITIONS = [
  {
    awayTeamIndex: 1,
    externalId: 9900001,
    hoursFromNow: 36,
    homeTeamIndex: 0,
    key: "northbridgeHarbor",
    matchday: 1,
    stage: "SHOWCASE",
  },
  {
    awayTeamIndex: 3,
    externalId: 9900002,
    hoursFromNow: 60,
    homeTeamIndex: 2,
    key: "kingsleyMaple",
    matchday: 1,
    stage: "SHOWCASE",
  },
] as const;

const USER_DEFINITIONS = [
  { email: "admin@sportsdeck.local", key: "commissioner", role: "ADMIN" as const, teamIndex: 0, username: "commissioner" },
  { email: "alex@sportsdeck.local", key: "alex", role: "USER" as const, teamIndex: 1, username: "alexmatchday" },
  { email: "maya@sportsdeck.local", key: "maya", role: "USER" as const, teamIndex: 2, username: "mayascout" },
  { email: "jordan@sportsdeck.local", key: "jordan", role: "USER" as const, teamIndex: 0, username: "jordantactics" },
  { email: "sam@sportsdeck.local", key: "sam", role: "USER" as const, teamIndex: 3, username: "samstands" },
  { email: "lina@sportsdeck.local", key: "lina", role: "USER" as const, teamIndex: 1, username: "linaterrace" },
  { email: "ethan@sportsdeck.local", key: "ethan", role: "USER" as const, teamIndex: 2, username: "ethanlines" },
  { email: "priya@sportsdeck.local", key: "priya", role: "USER" as const, teamIndex: 0, username: "priyapress" },
  { email: "marco@sportsdeck.local", key: "marco", role: "USER" as const, teamIndex: 3, username: "marcoblocks" },
  { email: "zoe@sportsdeck.local", key: "zoe", role: "USER" as const, teamIndex: 1, username: "zoezone14" },
  { email: "nico@sportsdeck.local", key: "nico", role: "USER" as const, teamIndex: 2, username: "nicoacademy" },
  { email: "riley@sportsdeck.local", key: "riley", role: "USER" as const, teamIndex: 0, username: "rileyrunout" },
  { email: "tessa@sportsdeck.local", key: "tessa", role: "USER" as const, teamIndex: 3, username: "tessatravel" },
  { email: "omar@sportsdeck.local", key: "omar", role: "USER" as const, teamIndex: 1, username: "omarpivot" },
  { email: "chloe@sportsdeck.local", key: "chloe", role: "USER" as const, teamIndex: 2, username: "chloechance" },
  { email: "ben@sportsdeck.local", key: "ben", role: "USER" as const, teamIndex: 0, username: "bencounter" },
  { email: "ava@sportsdeck.local", key: "ava", role: "USER" as const, teamIndex: 3, username: "avastands" },
  { email: "lucas@sportsdeck.local", key: "lucas", role: "USER" as const, teamIndex: 1, username: "lucaslofted" },
  { email: "nina@sportsdeck.local", key: "nina", role: "USER" as const, teamIndex: 2, username: "ninanumbers" },
  { email: "victor@sportsdeck.local", key: "victor", role: "USER" as const, teamIndex: 3, username: "victorvar" },
] as const;

type TeamRecord = {
  id: number;
  name: string;
  shortName: string | null;
  venue: string | null;
};

type UserRecord = {
  id: number;
  username: string;
};

type ShowcaseUsers = Record<string, UserRecord>;

type SeedDiscussion = {
  authorKey: string;
  body: string;
  key?: string;
  replies?: SeedReply[];
};

type SeedReply = {
  authorKey: string;
  body: string;
  key?: string;
};

function hoursFromNow(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function getTeamLabel(team: TeamRecord) {
  return team.shortName ?? team.name;
}

function getUser(users: ShowcaseUsers, key: string) {
  const user = users[key];
  if (!user) {
    throw new Error(`Missing seeded user for key "${key}"`);
  }

  return user;
}

async function ensureTeams(): Promise<TeamRecord[]> {
  const currentCount = await prisma.team.count();

  if (currentCount < 4) {
    for (const team of FALLBACK_TEAMS) {
      await prisma.team.upsert({
        where: { externalId: team.externalId },
        update: {
          crestUrl: team.crestUrl,
          name: team.name,
          shortName: team.shortName,
          venue: team.venue,
        },
        create: team,
      });
    }
  }

  const teams = await prisma.team.findMany({
    orderBy: [{ id: "asc" }],
    take: 4,
    select: {
      id: true,
      name: true,
      shortName: true,
      venue: true,
    },
  });

  if (teams.length < 4) {
    throw new Error("Unable to prepare at least four teams for demo data");
  }

  return teams;
}

async function ensureShowcaseUsers(teams: TeamRecord[]) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const users = await Promise.all(
    USER_DEFINITIONS.map((user) =>
      prisma.user.upsert({
        where: { email: user.email },
        update: {
          avatarUrl: null,
          banReason: null,
          banStatus: "NOT_BANNED",
          bannedAt: null,
          favoriteTeamId: teams[user.teamIndex].id,
          passwordHash,
          role: user.role,
          username: user.username,
        },
        create: {
          avatarUrl: null,
          banReason: null,
          banStatus: "NOT_BANNED",
          bannedAt: null,
          email: user.email,
          favoriteTeamId: teams[user.teamIndex].id,
          passwordHash,
          role: user.role,
          username: user.username,
        },
        select: {
          id: true,
          username: true,
        },
      })
    )
  );

  return Object.fromEntries(
    USER_DEFINITIONS.map((user, index) => [user.key, users[index]])
  ) as ShowcaseUsers;
}

async function ensureFollowGraph(users: ShowcaseUsers) {
  const orderedUsers = USER_DEFINITIONS.map((user) => getUser(users, user.key));
  const relationshipRows = orderedUsers.flatMap((user, index) => [
    {
      followerId: user.id,
      followingId: orderedUsers[(index + 1) % orderedUsers.length].id,
    },
    {
      followerId: user.id,
      followingId: orderedUsers[(index + 5) % orderedUsers.length].id,
    },
  ]);

  const featuredPairs = [
    ["alex", "commissioner"],
    ["alex", "jordan"],
    ["maya", "alex"],
    ["sam", "commissioner"],
    ["sam", "maya"],
    ["zoe", "omar"],
    ["nico", "chloe"],
    ["victor", "marco"],
  ] as const;

  await prisma.follow.createMany({
    data: [
      ...relationshipRows,
      ...featuredPairs.map(([followerKey, followingKey]) => ({
        followerId: getUser(users, followerKey).id,
        followingId: getUser(users, followingKey).id,
      })),
    ],
    skipDuplicates: true,
  });
}

async function syncThreadTags(threadId: number, tagNames: string[]) {
  const tags = await Promise.all(
    tagNames.map((name) =>
      prisma.tag.upsert({
        where: { name },
        update: {},
        create: { name },
        select: { id: true },
      })
    )
  );

  await prisma.threadTag.deleteMany({
    where: { threadId },
  });

  await prisma.threadTag.createMany({
    data: tags.map((tag) => ({
      tagId: tag.id,
      threadId,
    })),
    skipDuplicates: true,
  });
}

async function ensureThread(input: {
  authorId: number | null;
  closeAt?: Date | null;
  matchId?: number | null;
  openAt?: Date | null;
  tagNames: string[];
  teamId?: number | null;
  title: string;
  type: "GENERAL" | "TEAM" | "MATCH";
}) {
  const where = input.matchId
    ? { matchId: input.matchId }
    : {
        title: input.title,
        type: input.type,
      };

  const existing = await prisma.thread.findFirst({
    where,
    select: { id: true },
  });

  const thread = existing
    ? await prisma.thread.update({
        where: { id: existing.id },
        data: {
          authorId: input.authorId,
          closeAt: input.closeAt ?? null,
          matchId: input.matchId ?? null,
          openAt: input.openAt ?? null,
          status: "VISIBLE",
          teamId: input.teamId ?? null,
          title: input.title,
          type: input.type,
        },
        select: {
          id: true,
        },
      })
    : await prisma.thread.create({
        data: {
          authorId: input.authorId,
          closeAt: input.closeAt ?? null,
          matchId: input.matchId ?? null,
          openAt: input.openAt ?? null,
          status: "VISIBLE",
          teamId: input.teamId ?? null,
          title: input.title,
          type: input.type,
        },
        select: {
          id: true,
        },
      });

  await syncThreadTags(thread.id, input.tagNames);

  return thread;
}

async function ensurePost(input: {
  authorId: number;
  body: string;
  threadId: number;
}) {
  const existing = await prisma.post.findFirst({
    where: {
      body: input.body,
      threadId: input.threadId,
    },
    select: { id: true },
  });

  if (existing) {
    return prisma.post.update({
      where: { id: existing.id },
      data: {
        authorId: input.authorId,
        status: "VISIBLE",
      },
      select: { id: true },
    });
  }

  return prisma.post.create({
    data: {
      authorId: input.authorId,
      body: input.body,
      status: "VISIBLE",
      threadId: input.threadId,
    },
    select: { id: true },
  });
}

async function ensureReply(input: {
  authorId: number;
  body: string;
  postId: number;
}) {
  const existing = await prisma.reply.findFirst({
    where: {
      body: input.body,
      postId: input.postId,
    },
    select: { id: true },
  });

  if (existing) {
    return prisma.reply.update({
      where: { id: existing.id },
      data: {
        authorId: input.authorId,
        status: "VISIBLE",
      },
      select: { id: true },
    });
  }

  return prisma.reply.create({
    data: {
      authorId: input.authorId,
      body: input.body,
      status: "VISIBLE",
      postId: input.postId,
    },
    select: { id: true },
  });
}

async function ensureDiscussion(input: {
  discussions: SeedDiscussion[];
  threadId: number;
  users: ShowcaseUsers;
}) {
  const postsByKey = new Map<string, { id: number }>();
  const repliesByKey = new Map<string, { id: number }>();

  for (const discussion of input.discussions) {
    const post = await ensurePost({
      authorId: getUser(input.users, discussion.authorKey).id,
      body: discussion.body,
      threadId: input.threadId,
    });

    if (discussion.key) {
      postsByKey.set(discussion.key, post);
    }

    for (const reply of discussion.replies ?? []) {
      const createdReply = await ensureReply({
        authorId: getUser(input.users, reply.authorKey).id,
        body: reply.body,
        postId: post.id,
      });

      if (reply.key) {
        repliesByKey.set(reply.key, createdReply);
      }
    }
  }

  return { postsByKey, repliesByKey };
}

async function ensurePoll(input: {
  authorId: number;
  deadline: Date;
  optionTexts: string[];
  question: string;
  threadId: number;
  voterIds: number[];
}) {
  const existing = await prisma.poll.findFirst({
    where: {
      question: input.question,
      threadId: input.threadId,
    },
    select: { id: true },
  });

  if (existing) {
    return existing;
  }

  const poll = await prisma.poll.create({
    data: {
      authorId: input.authorId,
      deadline: input.deadline,
      question: input.question,
      threadId: input.threadId,
      options: {
        create: input.optionTexts.map((text) => ({ text })),
      },
    },
    select: {
      id: true,
      options: {
        orderBy: { id: "asc" },
        select: { id: true },
      },
    },
  });

  const firstOption = poll.options[0];
  const secondOption = poll.options[1] ?? poll.options[0];

  await prisma.pollVote.createMany({
    data: input.voterIds.map((voterId, index) => ({
      optionId: index % 2 === 0 ? firstOption.id : secondOption.id,
      pollId: poll.id,
      voterId,
    })),
    skipDuplicates: true,
  });

  return { id: poll.id };
}

async function ensureShowcaseMatches(teams: TeamRecord[]) {
  const matches = await Promise.all(
    SHOWCASE_MATCH_DEFINITIONS.map(async (matchDefinition) => {
      const homeTeam = teams[matchDefinition.homeTeamIndex];
      const awayTeam = teams[matchDefinition.awayTeamIndex];

      const match = await prisma.match.upsert({
        where: { externalId: matchDefinition.externalId },
        update: {
          awayTeamId: awayTeam.id,
          homeTeamId: homeTeam.id,
          lastFetchedAt: new Date(),
          matchday: matchDefinition.matchday,
          scoreAway: null,
          scoreHome: null,
          stage: matchDefinition.stage,
          status: "SCHEDULED",
          utcDate: hoursFromNow(matchDefinition.hoursFromNow),
          venue: homeTeam.venue ?? `${homeTeam.name} Stadium`,
        },
        create: {
          awayTeamId: awayTeam.id,
          externalId: matchDefinition.externalId,
          homeTeamId: homeTeam.id,
          lastFetchedAt: new Date(),
          matchday: matchDefinition.matchday,
          scoreAway: null,
          scoreHome: null,
          stage: matchDefinition.stage,
          status: "SCHEDULED",
          utcDate: hoursFromNow(matchDefinition.hoursFromNow),
          venue: homeTeam.venue ?? `${homeTeam.name} Stadium`,
        },
        select: { id: true },
      });

      return [matchDefinition.key, match] as const;
    })
  );

  return Object.fromEntries(matches) as Record<string, { id: number }>;
}

async function ensureModerationShowcase(input: {
  appealMessage?: string;
  adminId: number;
  banReason?: string;
  banUser?: boolean;
  reporterId: number;
  reportReason: string;
  replyId: number;
  userId: number;
}) {
  const report = await prisma.report.findFirst({
    where: {
      reason: input.reportReason,
      replyId: input.replyId,
      reporterId: input.reporterId,
    },
    select: { id: true },
  });

  if (!report) {
    await prisma.report.create({
      data: {
        reason: input.reportReason,
        replyId: input.replyId,
        reporterId: input.reporterId,
      },
    });
  }

  if (input.banUser) {
    await prisma.user.update({
      where: { id: input.userId },
      data: {
        banReason: input.banReason ?? "Seeded moderation example",
        banStatus: "BANNED",
        bannedAt: hoursFromNow(-48),
      },
    });
  }

  if (input.appealMessage) {
    const appeal = await prisma.appeal.findFirst({
      where: {
        message: input.appealMessage,
        userId: input.userId,
      },
      select: { id: true },
    });

    if (!appeal) {
      await prisma.appeal.create({
        data: {
          message: input.appealMessage,
          status: "OPEN",
          userId: input.userId,
        },
      });
    }
  }

  const existingAdmin = await prisma.user.findUnique({
    where: { id: input.adminId },
    select: { role: true },
  });

  if (existingAdmin?.role !== "ADMIN") {
    await prisma.user.update({
      where: { id: input.adminId },
      data: { role: "ADMIN" },
    });
  }
}

async function main() {
  const teams = await ensureTeams();
  const users = await ensureShowcaseUsers(teams);

  await ensureFollowGraph(users);

  const showcaseMatches = await ensureShowcaseMatches(teams);

  const welcomeThread = await ensureThread({
    authorId: getUser(users, "commissioner").id,
    tagNames: ["welcome", "community"],
    title: "Welcome to SportsDeck: introduce your club",
    type: "GENERAL",
  });

  const tacticsThread = await ensureThread({
    authorId: getUser(users, "jordan").id,
    tagNames: ["tactics", "team-talk"],
    teamId: teams[0].id,
    title: `How should ${getTeamLabel(teams[0])} rotate for the next stretch?`,
    type: "TEAM",
  });

  const matchThreadOne = await ensureThread({
    authorId: getUser(users, "alex").id,
    closeAt: hoursFromNow(72),
    matchId: showcaseMatches.northbridgeHarbor.id,
    openAt: hoursFromNow(-12),
    tagNames: ["matchday", "preview"],
    title: `${getTeamLabel(teams[0])} vs ${getTeamLabel(teams[1])} pre-match chat`,
    type: "MATCH",
  });

  const transferThread = await ensureThread({
    authorId: getUser(users, "maya").id,
    tagNames: ["transfers", "squad-building"],
    title: "Which squad move changes the top half race the most?",
    type: "GENERAL",
  });

  const breakoutThread = await ensureThread({
    authorId: getUser(users, "ethan").id,
    tagNames: ["scouting", "young-players"],
    title: "Breakout player watchlist for the next two months",
    type: "GENERAL",
  });

  const harborThread = await ensureThread({
    authorId: getUser(users, "omar").id,
    tagNames: ["pressing", "harbor-city"],
    teamId: teams[1].id,
    title: `What does ${getTeamLabel(teams[1])} need to fix before the run-in?`,
    type: "TEAM",
  });

  const academyThread = await ensureThread({
    authorId: getUser(users, "nico").id,
    tagNames: ["academy", "development"],
    teamId: teams[2].id,
    title: `Which ${getTeamLabel(teams[2])} academy player is next in line?`,
    type: "TEAM",
  });

  const awayDaysThread = await ensureThread({
    authorId: getUser(users, "tessa").id,
    tagNames: ["travel", "matchday"],
    teamId: teams[3].id,
    title: `Best away-day rituals for ${getTeamLabel(teams[3])} supporters`,
    type: "TEAM",
  });

  const matchThreadTwo = await ensureThread({
    authorId: getUser(users, "nico").id,
    closeAt: hoursFromNow(96),
    matchId: showcaseMatches.kingsleyMaple.id,
    openAt: hoursFromNow(-10),
    tagNames: ["matchday", "second-screen"],
    title: `${getTeamLabel(teams[2])} vs ${getTeamLabel(teams[3])} live buildup`,
    type: "MATCH",
  });

  const predictionsThread = await ensureThread({
    authorId: getUser(users, "priya").id,
    tagNames: ["predictions", "league-table"],
    title: "Weekend predictions and table swing tracker",
    type: "GENERAL",
  });

  await ensureDiscussion({
    discussions: [
      {
        authorKey: "commissioner",
        body:
          "Welcome to SportsDeck. Pick your club, say hello, and share the match or player that locked you into following the league.",
        key: "welcome-1",
        replies: [
          {
            authorKey: "sam",
            body:
              "The team filters sold me right away. It feels like a real supporter hub instead of a blank message board.",
          },
          {
            authorKey: "lina",
            body:
              "Same here. It is much easier to jump between league context and club-specific discussion than in most forum prototypes.",
          },
        ],
      },
      {
        authorKey: "maya",
        body:
          "I am here for the scouting notes and the match threads. Looking forward to seeing how people track form swings across the season.",
        key: "welcome-2",
        replies: [
          {
            authorKey: "ethan",
            body:
              "If people start posting academy clips and lineup ideas, this is going to get lively fast.",
          },
        ],
      },
      {
        authorKey: "priya",
        body:
          "I mostly want a place where prediction posts, tactical talk, and moderation tools all live in the same product demo.",
        key: "welcome-3",
        replies: [
          {
            authorKey: "commissioner",
            body:
              "That is the goal. We want the seeded data to show the full product surface instead of a nearly empty shell.",
          },
        ],
      },
    ],
    threadId: welcomeThread.id,
    users,
  });

  await ensureDiscussion({
    discussions: [
      {
        authorKey: "jordan",
        body:
          "I would rest one full-back and keep the midfield triangle intact. The side looks strongest when the second line can counter-press immediately after turnovers.",
        key: "tactics-1",
        replies: [
          {
            authorKey: "alex",
            body:
              "That shape also gives the wingers cleaner passing lanes. I would rather see an aggressive overlap than a conservative back three.",
          },
          {
            authorKey: "maya",
            body:
              "The data points the same way. Their best chance creation has come from wide recoveries and quick cutbacks, not slow possession around the box.",
          },
        ],
      },
      {
        authorKey: "riley",
        body:
          "My only concern is workload. The first-choice midfield pair has covered a lot of ground lately, and the late-game drop-off is starting to show.",
        key: "tactics-2",
        replies: [
          {
            authorKey: "ben",
            body:
              "If they rotate too much at once, the press loses its shape. One controlled change might be the sweet spot.",
          },
        ],
      },
      {
        authorKey: "ben",
        body:
          "I would start the bench winger if the plan is to stretch the full-backs early. He gives them a direct outlet they have been missing.",
        key: "tactics-3",
      },
      {
        authorKey: "priya",
        body:
          "It might be worth posting the likely bench minutes too. Fans usually debate the starters, but the finishing lineup has decided a few recent matches.",
        key: "tactics-4",
      },
    ],
    threadId: tacticsThread.id,
    users,
  });

  const matchOneDiscussion = await ensureDiscussion({
    discussions: [
      {
        authorKey: "alex",
        body:
          "Prediction time: strong first half from the hosts, but the away side will make this chaotic if the midfield press slips after the break.",
        key: "match1-1",
        replies: [
          {
            authorKey: "sam",
            body:
              "If the press slips, this turns into a track meet. The bench depth will decide it, not the opening lineup.",
            key: "report-sam",
          },
          {
            authorKey: "commissioner",
            body:
              "That is exactly why this match is a good showcase for the forum. There are enough angles here for both casual predictions and deeper tactical breakdowns.",
          },
        ],
      },
      {
        authorKey: "sam",
        body:
          "Harbor City will get chances from set pieces even if they lose territory. The delivery quality has been too good lately to ignore.",
        key: "match1-2",
        replies: [
          {
            authorKey: "nina",
            body:
              "Their expected threat from dead balls has climbed every week. That is probably the cleanest path to an upset.",
          },
        ],
      },
      {
        authorKey: "lina",
        body:
          "I am more interested in who starts on the left. If the manager chooses control over pace, the game state could stay tight for an hour.",
        key: "match1-3",
      },
      {
        authorKey: "victor",
        body:
          "My script for this one is simple: fast start, one momentum swing, and a nervy final ten minutes with everyone refreshing the thread.",
        key: "match1-4",
      },
    ],
    threadId: matchThreadOne.id,
    users,
  });

  const transferDiscussion = await ensureDiscussion({
    discussions: [
      {
        authorKey: "maya",
        body:
          "Which profile changes the race more this month: a ball-progressing midfielder, a high-volume winger, or a backup center-back who can actually defend space?",
        key: "transfer-1",
        replies: [
          {
            authorKey: "zoe",
            body:
              "A ball-progressor for me. Too many teams can defend in shape, but not enough can play through the first line cleanly.",
          },
          {
            authorKey: "lucas",
            body:
              "I still think the loan market is where the value is. The right six-month fit can change a season faster than a long-term gamble.",
          },
        ],
      },
      {
        authorKey: "omar",
        body:
          "Depth at full-back is the sneaky need. Once two-match weeks hit, the drop from starter to backup is where points disappear.",
        key: "transfer-2",
      },
      {
        authorKey: "victor",
        body:
          "If another team spends big on vibes instead of fit, this forum is going to have material for days.",
        key: "transfer-3",
        replies: [
          {
            authorKey: "chloe",
            body:
              "Harsh, but not wrong. Recruitment should answer a tactical problem, not a social-media brief.",
            key: "report-victor",
          },
        ],
      },
    ],
    threadId: transferThread.id,
    users,
  });

  await ensureDiscussion({
    discussions: [
      {
        authorKey: "ethan",
        body:
          "My early breakout pick is the Kingsley winger who keeps attacking the back post. The chance volume is better than the headline numbers suggest.",
        key: "breakout-1",
        replies: [
          {
            authorKey: "chloe",
            body:
              "I like that shout, but the Maple full-back might get there first if the coaching staff finally trust him for longer spells.",
          },
        ],
      },
      {
        authorKey: "nina",
        body:
          "The tricky part is separating role changes from true breakout form. A few of these young players are simply getting touches in better zones now.",
        key: "breakout-2",
      },
      {
        authorKey: "ava",
        body:
          "Can we track this with a monthly thread? It would be fun to revisit who people backed before the wider league caught on.",
        key: "breakout-3",
      },
    ],
    threadId: breakoutThread.id,
    users,
  });

  await ensureDiscussion({
    discussions: [
      {
        authorKey: "omar",
        body:
          "The pressing triggers are still inconsistent. Harbor City looks sharp when the front three jump together and ordinary when one player hesitates.",
        key: "harbor-1",
        replies: [
          {
            authorKey: "alex",
            body:
              "That hesitation has shown up after halftime too. The first twenty minutes and the last twenty minutes look like different teams.",
          },
        ],
      },
      {
        authorKey: "zoe",
        body:
          "I would also like to see faster switches after recoveries. They win the ball in good spots and then spend two passes resetting the attack.",
        key: "harbor-2",
      },
      {
        authorKey: "lucas",
        body:
          "Set-piece defending remains the hidden issue. Even when results look stable, the box organization has been wobbly.",
        key: "harbor-3",
      },
    ],
    threadId: harborThread.id,
    users,
  });

  await ensureDiscussion({
    discussions: [
      {
        authorKey: "nico",
        body:
          "The next academy player I want to see is the midfielder who keeps breaking pressure with one touch. He looks ready for selective senior minutes.",
        key: "academy-1",
        replies: [
          {
            authorKey: "maya",
            body:
              "Agreed. His scanning is ahead of schedule, and he already plays like someone who understands the next pass before receiving.",
          },
        ],
      },
      {
        authorKey: "chloe",
        body:
          "I am also watching the center-back who steps into midfield. The physical tools are obvious, but the calmer distribution is what caught my eye.",
        key: "academy-2",
      },
      {
        authorKey: "ethan",
        body:
          "If the club is serious about development, the cup rotation should include at least two academy starts next month.",
        key: "academy-3",
      },
    ],
    threadId: academyThread.id,
    users,
  });

  await ensureDiscussion({
    discussions: [
      {
        authorKey: "tessa",
        body:
          "Best away-day ritual question: what is the first thing you do after tickets are confirmed, and which ground actually lives up to the hype?",
        key: "away-1",
        replies: [
          {
            authorKey: "ava",
            body:
              "I build the food map first, then the train plan. A good away day starts with knowing where the supporters drift before kickoff.",
          },
        ],
      },
      {
        authorKey: "sam",
        body:
          "Maple supporters have the loudest late-arriving section in the league. You can feel the energy shift when that end fills up.",
        key: "away-2",
      },
      {
        authorKey: "marco",
        body:
          "I still think the best trips are the ones with awkward kickoff times. Everyone commits harder when the logistics are slightly unreasonable.",
        key: "away-3",
      },
    ],
    threadId: awayDaysThread.id,
    users,
  });

  await ensureDiscussion({
    discussions: [
      {
        authorKey: "nico",
        body:
          "This second showcase match feels like a swing game for both clubs. Whoever handles transition defense better probably owns the night.",
        key: "match2-1",
        replies: [
          {
            authorKey: "marco",
            body:
              "I lean toward Kingsley because their rest defense has been tidier lately, even if the final-third execution still wobbles.",
          },
        ],
      },
      {
        authorKey: "marco",
        body:
          "Maple can absolutely win this if they survive the first press wave. Once the tempo settles, their wide rotations become awkward to track.",
        key: "match2-2",
      },
      {
        authorKey: "victor",
        body:
          "I just want one match thread where the live takes stay calm for more than five minutes after kickoff.",
        key: "match2-3",
      },
      {
        authorKey: "commissioner",
        body:
          "Thread reminder: predictions are welcome, but keep the criticism on performances and decisions rather than each other.",
        key: "match2-4",
      },
    ],
    threadId: matchThreadTwo.id,
    users,
  });

  await ensureDiscussion({
    discussions: [
      {
        authorKey: "priya",
        body:
          "Weekend prediction starter: I think two of the top four drop points, but the table barely moves because everyone around them also has awkward fixtures.",
        key: "predictions-1",
        replies: [
          {
            authorKey: "ben",
            body:
              "That sounds exactly right. Feels like a week where the race tightens emotionally more than mathematically.",
          },
        ],
      },
      {
        authorKey: "ben",
        body:
          "My bold call is that the best defensive performance of the weekend comes from a side nobody trusts to keep a clean sheet.",
        key: "predictions-2",
      },
      {
        authorKey: "lucas",
        body:
          "I am tracking the table swing more than the raw results. Goal difference and home form are starting to matter again.",
        key: "predictions-3",
      },
    ],
    threadId: predictionsThread.id,
    users,
  });

  await ensurePoll({
    authorId: getUser(users, "commissioner").id,
    deadline: hoursFromNow(120),
    optionTexts: [
      `${getTeamLabel(teams[0])} win`,
      "Draw",
      `${getTeamLabel(teams[1])} win`,
    ],
    question: "Who takes the points in the showcase fixture?",
    threadId: matchThreadOne.id,
    voterIds: [
      getUser(users, "alex").id,
      getUser(users, "maya").id,
      getUser(users, "jordan").id,
      getUser(users, "sam").id,
      getUser(users, "lina").id,
      getUser(users, "omar").id,
      getUser(users, "nina").id,
      getUser(users, "victor").id,
    ],
  });

  await ensurePoll({
    authorId: getUser(users, "priya").id,
    deadline: hoursFromNow(144),
    optionTexts: [
      getTeamLabel(teams[0]),
      getTeamLabel(teams[1]),
      getTeamLabel(teams[2]),
      getTeamLabel(teams[3]),
    ],
    question: "Which club gains the most ground over the next round?",
    threadId: predictionsThread.id,
    voterIds: USER_DEFINITIONS.slice(0, 10).map((user) => getUser(users, user.key).id),
  });

  await ensureModerationShowcase({
    adminId: getUser(users, "commissioner").id,
    appealMessage:
      "I pushed the tone too far in that match thread. I would like the account restored and I will keep future posts focused on the football.",
    banReason: "Seeded moderation example for the admin appeal queue.",
    banUser: true,
    reportReason: "Possible personal attack in the pre-match thread.",
    reporterId: getUser(users, "maya").id,
    replyId: matchOneDiscussion.repliesByKey.get("report-sam")!.id,
    userId: getUser(users, "sam").id,
  });

  await ensureModerationShowcase({
    adminId: getUser(users, "commissioner").id,
    appealMessage:
      "My transfer-window comment was sarcastic, but I understand why it was flagged and I will cool the tone down.",
    banReason: "Seeded moderation example showing a second appeal.",
    banUser: true,
    reportReason: "Needlessly inflammatory tone in the transfer discussion.",
    reporterId: getUser(users, "zoe").id,
    replyId: transferDiscussion.repliesByKey.get("report-victor")!.id,
    userId: getUser(users, "victor").id,
  });

  const totalPosts = await prisma.post.count();
  const totalReplies = await prisma.reply.count();
  const totalThreads = await prisma.thread.count();
  const totalUsers = await prisma.user.count();

  console.log(
    `Imported showcase data with ${totalUsers} users, ${totalThreads} threads, ${totalPosts} posts, and ${totalReplies} replies.`
  );
  console.log(`Demo password for seeded users: ${DEMO_PASSWORD}`);
}

main()
  .catch((error: unknown) => {
    console.error("Failed to import demo data:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
