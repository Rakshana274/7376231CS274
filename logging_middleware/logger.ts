// logging_middleware/logger.ts
// Reusable logging middleware for AffordMed evaluation server.
// Usage: import Log from '../logging_middleware/logger'
//        Log("backend", "info", "service", "Server started on port 3000")

const LOG_URL = "http://4.224.186.213/evaluation-service/logs";
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || "YOUR_ACCESS_TOKEN_HERE";

type Stack = "backend" | "frontend";

type Level = "debug" | "info" | "warn" | "error" | "fatal";

type Package =
  // Backend only
  | "cache"
  | "controller"
  | "cron_job"
  | "db"
  | "domain"
  | "handler"
  | "repository"
  | "route"
  | "service"
  // Frontend only
  | "api"
  | "component"
  | "hook"
  | "page"
  | "state"
  | "style"
  // Both
  | "auth"
  | "config"
  | "middleware"
  | "utils";

async function Log(
  stack: Stack,
  level: Level,
  pkg: Package,
  message: string
): Promise<void> {
  try {
    const res = await fetch(LOG_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        stack,
        level,
        package: pkg,
        message,
      }),
    });

    const data = await res.json();
    console.log(
      `[LOG] ${level.toUpperCase()} | ${stack} | ${pkg} | ${message} → logID: ${data.logID}`
    );
  } catch (err) {
    console.error("[LOG FAILED]", err);
  }
}

export default Log;