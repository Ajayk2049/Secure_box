import fs from "fs";
import path from "path";
import readline from "readline";
import { pino } from "pino";

// Ensure logs directory exists
const logsDir = path.resolve(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

export const logFilePath = path.join(logsDir, "app.log");
export const archiveLogPath = path.join(logsDir, "app.log.1");

// Maximum log file size: 25 MB (strictly enforced across both live and archive logs)
export const MAX_LOG_SIZE_BYTES = 25 * 1024 * 1024;
const ONE_HOUR_MS = 60 * 60 * 1000;

export const fileDestination = (pino as any).destination({
  dest: logFilePath,
  sync: false,
  mkdir: true,
});

// Support external logrotate via SIGUSR2 signal (Unix/Linux standard)
process.on("SIGUSR2", () => {
  try {
    if (typeof fileDestination.reopen === "function") {
      fileDestination.reopen();
    }
  } catch {}
});

export const loggerConfig = {
  level: "info",
  serializers: {
    req(request: any) {
      return {
        method: request.method,
        url: request.url,
        params: request.params,
        query: request.query,
      };
    },
    res(reply: any) {
      return {
        statusCode: reply.statusCode,
      };
    },
    err: (pino as any).stdSerializers?.err,
  },
};

export const loggerStream = (pino as any).multistream([
  {
    level: "info",
    stream: fileDestination,
  },
  {
    level: "info",
    stream: (pino as any).transport({
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:HH:MM:ss",
        ignore: "pid,hostname,reqId",
        messageFormat: "{msg}",
      },
    }),
  },
]);

export function isSilentTerminalPath(url: string, method: string): boolean {
  if (method === "OPTIONS") return true;
  if (url === "/health" || url === "/api/health") return true;
  return false;
}

function parseLogTime(line: string): number | null {
  try {
    const parsed = JSON.parse(line);
    const timeVal = typeof parsed.time === "number" ? parsed.time : new Date(parsed.time).getTime();
    return isNaN(timeVal) ? null : timeVal;
  } catch {
    return null;
  }
}

async function* streamLines(files: string[]) {
  for (const filePath of files) {
    if (!fs.existsSync(filePath)) continue;
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath, { encoding: "utf-8" }),
      crlfDelay: Infinity,
    });
    for await (const line of rl) {
      if (line && line.trim()) yield line;
    }
  }
}

let isPruning = false;
let lastRotationTime = 0;

/**
 * Rotates and prunes logs safely without corrupting live file descriptors:
 * 1. Renames live app.log -> app.log.<timestamp>.rotating and calls fileDestination.reopen()
 *    (Pino writes to fresh app.log at offset 0; zero NUL holes, zero dropped logs).
 * 2. Streams previous archive + rotated lines, pruning entries older than 24h.
 * 3. Enforces strict 25 MB cap by dropping oldest lines if total exceeds MAX_LOG_SIZE_BYTES.
 * 4. Saves clean historical window into app.log.1.
 */
export async function pruneLogsOlderThan24Hours(): Promise<{ retained: number; pruned: number }> {
  if (isPruning) return { retained: 0, pruned: 0 };
  isPruning = true;

  try {
    const liveStats = await fs.promises.stat(logFilePath).catch(() => null);
    const hasLiveContent = liveStats && liveStats.size > 0;
    const hasArchive = fs.existsSync(archiveLogPath);

    if (!hasLiveContent && !hasArchive) {
      return { retained: 0, pruned: 0 };
    }

    const shouldRotate =
      hasLiveContent &&
      (liveStats.size >= MAX_LOG_SIZE_BYTES || Date.now() - lastRotationTime >= ONE_HOUR_MS);

    let rotatedPath: string | null = null;

    if (shouldRotate) {
      // Step 1: Flush pending buffers
      if (typeof fileDestination.flushSync === "function") {
        try { fileDestination.flushSync(); } catch {}
      }

      // Step 2: Atomic rename live log
      rotatedPath = `${logFilePath}.${Date.now()}.rotating`;
      await fs.promises.rename(logFilePath, rotatedPath);

      // Step 3: Reopen destination so Pino immediately begins writing to fresh app.log at offset 0
      if (typeof fileDestination.reopen === "function") {
        fileDestination.reopen();
      }
      lastRotationTime = Date.now();
    }

    const filesToProcess = [archiveLogPath, rotatedPath].filter(Boolean) as string[];
    if (filesToProcess.length === 0) {
      return { retained: 0, pruned: 0 };
    }

    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;

    // Pass 1: Calculate total valid bytes within 24-hour window
    let totalValidBytes = 0;
    let prunedCount = 0;

    for await (const line of streamLines(filesToProcess)) {
      const timeVal = parseLogTime(line);
      if (timeVal === null || timeVal >= twentyFourHoursAgo) {
        totalValidBytes += Buffer.byteLength(line, "utf-8") + 1;
      } else {
        prunedCount++;
      }
    }

    let bytesToSkip = Math.max(0, totalValidBytes - MAX_LOG_SIZE_BYTES);
    let retainedCount = 0;

    const tempArchive = `${archiveLogPath}.${Date.now()}.tmp`;
    const writeStream = fs.createWriteStream(tempArchive, { encoding: "utf-8" });

    // Pass 2: Stream lines into tempArchive, skipping the oldest bytesToSkip to enforce 25 MB cap
    for await (const line of streamLines(filesToProcess)) {
      const timeVal = parseLogTime(line);
      if (timeVal === null || timeVal >= twentyFourHoursAgo) {
        const lineBytes = Buffer.byteLength(line, "utf-8") + 1;
        if (bytesToSkip > 0) {
          bytesToSkip -= lineBytes;
          prunedCount++;
        } else {
          writeStream.write(line + "\n");
          retainedCount++;
        }
      }
    }

    await new Promise<void>((resolve, reject) => {
      writeStream.end(() => resolve());
      writeStream.on("error", reject);
    });

    // Replace previous archive with freshly consolidated, size-capped archive
    await fs.promises.rename(tempArchive, archiveLogPath);

    // Cleanup temporary rotated file
    if (rotatedPath) {
      await fs.promises.unlink(rotatedPath).catch(() => {});
    }

    return { retained: retainedCount, pruned: prunedCount };
  } catch {
    return { retained: 0, pruned: 0 };
  } finally {
    isPruning = false;
  }
}
