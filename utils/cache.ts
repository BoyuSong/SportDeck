import { Socket } from "node:net";

export type CacheStatus = "BYPASS" | "HIT" | "MISS";

type RedisValue = number | string | null | RedisValue[];
type CacheHealth = {
  configured: boolean;
  reachable: boolean;
};
type CacheResult<T> = {
  status: CacheStatus;
  value: T;
};

const CACHE_HOST = process.env.CACHE_HOST?.trim() ?? "";
const CACHE_NAMESPACE = process.env.CACHE_NAMESPACE?.trim() || "sportsdeck";
const CACHE_PORT = parsePositiveInt(process.env.CACHE_PORT, 6379);
const CACHE_TTL_SECONDS = parsePositiveInt(process.env.CACHE_TTL_SECONDS, 300);
const SOCKET_TIMEOUT_MS = parsePositiveInt(process.env.CACHE_TIMEOUT_MS, 1500);

let hasWarnedAboutCache = false;

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isCacheConfigured() {
  return CACHE_HOST.length > 0;
}

function namespacedKey(key: string) {
  return `${CACHE_NAMESPACE}:${key}`;
}

function encodeCommand(args: string[]) {
  return `*${args.length}\r\n${args
    .map((arg) => `$${Buffer.byteLength(arg, "utf8")}\r\n${arg}\r\n`)
    .join("")}`;
}

function findLineEnd(buffer: Buffer, start: number) {
  for (let index = start; index < buffer.length - 1; index += 1) {
    if (buffer[index] === 13 && buffer[index + 1] === 10) {
      return index;
    }
  }

  return -1;
}

function parseRedisValue(buffer: Buffer, start = 0): { nextIndex: number; value: RedisValue } | null {
  if (start >= buffer.length) {
    return null;
  }

  const prefix = String.fromCharCode(buffer[start]);
  const lineEnd = findLineEnd(buffer, start + 1);
  if (lineEnd === -1) {
    return null;
  }

  const line = buffer.toString("utf8", start + 1, lineEnd);
  const bodyStart = lineEnd + 2;

  if (prefix === "+") {
    return { nextIndex: bodyStart, value: line };
  }

  if (prefix === "-") {
    throw new Error(`Redis error: ${line}`);
  }

  if (prefix === ":") {
    return { nextIndex: bodyStart, value: Number.parseInt(line, 10) };
  }

  if (prefix === "$") {
    const length = Number.parseInt(line, 10);
    if (length === -1) {
      return { nextIndex: bodyStart, value: null };
    }

    const bodyEnd = bodyStart + length;
    if (buffer.length < bodyEnd + 2) {
      return null;
    }

    return {
      nextIndex: bodyEnd + 2,
      value: buffer.toString("utf8", bodyStart, bodyEnd),
    };
  }

  if (prefix === "*") {
    const length = Number.parseInt(line, 10);
    if (length === -1) {
      return { nextIndex: bodyStart, value: null };
    }

    const values: RedisValue[] = [];
    let nextIndex = bodyStart;

    for (let itemIndex = 0; itemIndex < length; itemIndex += 1) {
      const parsed = parseRedisValue(buffer, nextIndex);
      if (!parsed) {
        return null;
      }

      values.push(parsed.value);
      nextIndex = parsed.nextIndex;
    }

    return { nextIndex, value: values };
  }

  throw new Error(`Unsupported Redis response prefix '${prefix}'`);
}

async function runRedisCommand(args: string[]) {
  return new Promise<RedisValue>((resolve, reject) => {
    const socket = new Socket();
    let buffer = Buffer.alloc(0);
    let settled = false;

    const finish = (handler: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      handler();
    };

    const timeout = setTimeout(() => {
      socket.destroy();
      finish(() => reject(new Error("Timed out while waiting for the cache server")));
    }, SOCKET_TIMEOUT_MS);

    socket.setNoDelay(true);

    socket.on("connect", () => {
      socket.write(encodeCommand(args));
    });

    socket.on("data", (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);

      try {
        const parsed = parseRedisValue(buffer);
        if (!parsed) {
          return;
        }

        socket.end();
        finish(() => resolve(parsed.value));
      } catch (error) {
        socket.destroy();
        finish(() => reject(error));
      }
    });

    socket.on("error", (error) => {
      finish(() => reject(error));
    });

    socket.on("close", () => {
      if (!settled) {
        finish(() =>
          reject(new Error("Cache connection closed before a complete response was received"))
        );
      }
    });

    socket.connect(CACHE_PORT, CACHE_HOST);
  });
}

function warnOnce(error: unknown) {
  if (hasWarnedAboutCache) {
    return;
  }

  hasWarnedAboutCache = true;
  console.warn("Redis cache unavailable, bypassing cache requests.", error);
}

export async function getCacheHealth(): Promise<CacheHealth> {
  if (!isCacheConfigured()) {
    return { configured: false, reachable: false };
  }

  try {
    const response = await runRedisCommand(["PING"]);
    return { configured: true, reachable: response === "PONG" };
  } catch (error) {
    warnOnce(error);
    return { configured: true, reachable: false };
  }
}

export async function getOrSetJson<T>(
  key: string,
  loader: () => Promise<T>,
  ttlSeconds = CACHE_TTL_SECONDS
): Promise<CacheResult<T>> {
  if (!isCacheConfigured()) {
    return { status: "BYPASS", value: await loader() };
  }

  const fullKey = namespacedKey(key);

  try {
    const cached = await runRedisCommand(["GET", fullKey]);

    if (typeof cached === "string") {
      return {
        status: "HIT",
        value: JSON.parse(cached) as T,
      };
    }
  } catch (error) {
    warnOnce(error);
    return { status: "BYPASS", value: await loader() };
  }

  const value = await loader();

  try {
    await runRedisCommand(["SET", fullKey, JSON.stringify(value), "EX", String(ttlSeconds)]);
    return { status: "MISS", value };
  } catch (error) {
    warnOnce(error);
    return { status: "BYPASS", value };
  }
}
