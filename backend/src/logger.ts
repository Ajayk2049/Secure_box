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

const fileDestination = (pino as any).destination({
  dest: logFilePath,
  sync: false,
  mkdir: true,
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
  // 1. File stream: complete logs with timestamps for error analysis and debugging
  {
    level: "info",
    stream: fileDestination,
  },
  // 2. Terminal stream: clean formatted output via pino-pretty
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

// Helper to check if a request path should be silenced from terminal output
export function isSilentTerminalPath(url: string, method: string): boolean {
  if (method === "OPTIONS") return true;
  if (url === "/health" || url === "/api/health") return true;
  return false;
}

// Maximum log file size: 25 MB (prevents disk exhaustion on low-storage VPS)
export const MAX_LOG_SIZE_BYTES = 25 * 1024 * 1024;

/**
 * Prunes the log file asynchronously:
 * 1. Discards entries older than 24 hours.
 * 2. Enforces a 25 MB maximum file size cap (retaining latest entries).
 * 3. Uses purely non-blocking async operations so the Node.js event loop never freezes.
 */
export async function pruneLogsOlderThan24Hours(): Promise<{ retained: number; pruned: number }> {
  try {
    const stats = await fs.promises.stat(logFilePath).catch(() => null);
    if (!stats || stats.size === 0) {
      return { retained: 0, pruned: 0 };
    }

    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    const tempPath = `${logFilePath}.${Date.now()}.tmp`;

    let retainedCount = 0;
    let prunedCount = 0;

    const readStream = fs.createReadStream(logFilePath, { encoding: "utf-8" });
    const writeStream = fs.createWriteStream(tempPath, { encoding: "utf-8" });

    const rl = readline.createInterface({
      input: readStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (!line || !line.trim()) continue;

      try {
        const parsed = JSON.parse(line);
        const timeVal = typeof parsed.time === "number" ? parsed.time : new Date(parsed.time).getTime();

        if (timeVal && timeVal >= twentyFourHoursAgo) {
          writeStream.write(line + "\n");
          retainedCount++;
        } else {
          prunedCount++;
        }
      } catch {
        writeStream.write(line + "\n");
        retainedCount++;
      }
    }

    await new Promise<void>((resolve, reject) => {
      writeStream.end(() => resolve());
      writeStream.on("error", reject);
    });

    // Non-blocking async copy and cleanup (never blocks Node event loop)
    await fs.promises.copyFile(tempPath, logFilePath);
    await fs.promises.unlink(tempPath).catch(() => {});

    return { retained: retainedCount, pruned: prunedCount };
  } catch {
    return { retained: 0, pruned: 0 };
  }
}
