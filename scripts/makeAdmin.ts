import { PrismaClient, type Prisma } from "../prisma/generated/index.js";

const prisma = new PrismaClient();

type Args = {
  email: string | null;
  help?: boolean;
  id: string | null;
  username: string | null;
};

function printUsage() {
  console.error(
    [
      "Usage:",
      "  node scripts/makeAdmin.ts --email user@example.com",
      "  node scripts/makeAdmin.ts --username someuser",
      "  node scripts/makeAdmin.ts --id 1",
      "",
      "Only one selector can be provided at a time.",
    ].join("\n")
  );
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    id: null,
    email: null,
    username: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (current === "--id") {
      if (!next) {
        throw new Error("Missing value for --id");
      }
      args.id = next;
      index += 1;
      continue;
    }

    if (current === "--email") {
      if (!next) {
        throw new Error("Missing value for --email");
      }
      args.email = next;
      index += 1;
      continue;
    }

    if (current === "--username") {
      if (!next) {
        throw new Error("Missing value for --username");
      }
      args.username = next;
      index += 1;
      continue;
    }

    if (current === "--help" || current === "-h") {
      args.help = true;
      continue;
    }

    throw new Error(`Unknown argument: ${current}`);
  }

  return args;
}

function buildWhereClause(args: Args): Prisma.UserWhereUniqueInput {
  const selectors = [
    args.id !== null,
    args.email !== null,
    args.username !== null,
  ].filter(Boolean).length;

  if (selectors !== 1) {
    throw new Error("Provide exactly one of --id, --email, or --username");
  }

  if (args.id !== null) {
    const id = Number(args.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error("--id must be a positive integer");
    }

    return { id };
  }

  if (args.email !== null) {
    const email = args.email.trim().toLowerCase();
    if (!email) {
      throw new Error("--email cannot be empty");
    }

    return { email };
  }

  const username = args.username?.trim() ?? "";
  if (!username) {
    throw new Error("--username cannot be empty");
  }

  return { username };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    return;
  }

  const where = buildWhereClause(args);

  const user = await prisma.user.findUnique({
    where,
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.role === "ADMIN") {
    console.log(
      `User ${user.username} (${user.email}, id=${user.id}) is already an admin.`
    );
    return;
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { role: "ADMIN" },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
    },
  });

  console.log(
    `Promoted ${updatedUser.username} (${updatedUser.email}, id=${updatedUser.id}) to ${updatedUser.role}.`
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    printUsage();
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
