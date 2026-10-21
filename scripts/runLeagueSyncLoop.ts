import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const DEFAULT_INTERVAL_HOURS = 24;

function parsePositiveNumber(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function formatDuration(ms: number) {
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return `${hours}h`;
  }
  if (hours === 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
}

async function runSyncOnce() {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/initLeagueData.ts"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`League sync exited because of signal ${signal}`));
        return;
      }

      if (code !== 0) {
        reject(new Error(`League sync exited with code ${code}`));
        return;
      }

      resolve();
    });
  });
}

async function main() {
  const intervalHours = parsePositiveNumber(
    process.env.LEAGUE_SYNC_INTERVAL_HOURS,
    DEFAULT_INTERVAL_HOURS
  );
  const runImmediately = parseBoolean(process.env.LEAGUE_SYNC_RUN_IMMEDIATELY, false);
  const intervalMs = intervalHours * 60 * 60 * 1000;

  console.log(
    `League sync worker started (interval=${intervalHours}h, runImmediately=${runImmediately}).`
  );

  if (runImmediately) {
    try {
      await runSyncOnce();
      console.log("Initial league sync completed successfully.");
    } catch (error) {
      console.error("Initial league sync failed:", error);
    }
  }

  while (true) {
    console.log(`Next league sync scheduled in ${formatDuration(intervalMs)}.`);
    await sleep(intervalMs);

    try {
      await runSyncOnce();
      console.log("Scheduled league sync completed successfully.");
    } catch (error) {
      console.error("Scheduled league sync failed:", error);
    }
  }
}

main().catch((error: unknown) => {
  console.error("League sync worker crashed:", error);
  process.exitCode = 1;
});
