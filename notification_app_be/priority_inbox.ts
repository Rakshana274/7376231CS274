// notification_app_be/priority_inbox.ts
// Stage 6 — Priority Inbox
// Fetches notifications from the evaluation API and returns the top N
// most important unread notifications using a weighted priority score.
//
// Priority order (per spec): Placement > Result > Event
// Tie-breaking: most recent timestamp wins

import Log from "../logging_middleware/logger";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Notification {
  ID: string;
  Type: "Placement" | "Result" | "Event";
  Message: string;
  Timestamp: string;
}

interface PriorityNotification extends Notification {
  priorityScore: number;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const BASE_URL = "http://4.224.186.213/evaluation-service";
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || "YOUR_ACCESS_TOKEN_HERE";

const HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${ACCESS_TOKEN}`,
};

/**
 * Type weights per spec: Placement > Result > Event
 */
const TYPE_WEIGHT: Record<string, number> = {
  Placement: 30,
  Result:    20,
  Event:     10,
};

// ─── Fetch Notifications ─────────────────────────────────────────────────────

async function fetchNotifications(): Promise<Notification[]> {
  await Log("backend", "info", "service", "Fetching notifications from evaluation service");
  try {
    const res = await fetch(`${BASE_URL}/notifications`, { headers: HEADERS });
    if (!res.ok) {
      await Log("backend", "error", "handler", `Notifications fetch failed: HTTP ${res.status}`);
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    await Log("backend", "info", "service", `Fetched ${data.notifications.length} notifications`);
    return data.notifications as Notification[];
  } catch (err) {
    await Log("backend", "fatal", "service", `fetchNotifications error: ${err}`);
    throw err;
  }
}

// ─── Priority Score ───────────────────────────────────────────────────────────
/**
 * Score = TYPE_WEIGHT + recencyBonus
 *
 * recencyBonus:
 *   +10 if notification is less than 24 hours old
 *   +5  if notification is less than 7 days old
 *   +0  otherwise
 */
function computePriorityScore(notification: Notification): number {
  const typeScore = TYPE_WEIGHT[notification.Type] ?? 0;

  const ageMs = Date.now() - new Date(notification.Timestamp).getTime();
  const ONE_DAY_MS  = 24 * 60 * 60 * 1000;
  const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;

  let recencyBonus = 0;
  if (ageMs <= ONE_DAY_MS)       recencyBonus = 10;
  else if (ageMs <= SEVEN_DAYS_MS) recencyBonus = 5;

  return typeScore + recencyBonus;
}

// ─── Top-N Priority Selection ─────────────────────────────────────────────────
/**
 * Returns the top `n` notifications sorted by priorityScore (desc).
 * Ties are broken by Timestamp (most recent first).
 *
 * For large volumes a min-heap gives O(k log n) vs O(k log k) for sort,
 * but Array.sort is sufficient for typical notification counts.
 */
function getTopN(notifications: Notification[], n: number): PriorityNotification[] {
  const scored: PriorityNotification[] = notifications.map((notif) => ({
    ...notif,
    priorityScore: computePriorityScore(notif),
  }));

  scored.sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    // tie-break: newer first
    return new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime();
  });

  return scored.slice(0, n);
}

// ─── Display ─────────────────────────────────────────────────────────────────

function printPriorityInbox(notifications: PriorityNotification[], n: number): void {
  console.log(`\n╔══════════════════════════════════════════════════╗`);
  console.log(`║     PRIORITY INBOX — TOP ${String(n).padEnd(2)} NOTIFICATIONS      ║`);
  console.log(`╚══════════════════════════════════════════════════╝\n`);

  notifications.forEach((notif, i) => {
    const ts = new Date(notif.Timestamp).toLocaleString();
    console.log(`  #${i + 1}  [Score: ${notif.priorityScore}]  ${notif.Type.padEnd(10)}  ${ts}`);
    console.log(`       📢 ${notif.Message}`);
    console.log(`       ID: ${notif.ID}`);
    console.log();
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function runPriorityInbox(topN: number = 10): Promise<void> {
  await Log("backend", "info", "service", `Priority Inbox: computing top ${topN} notifications`);

  const notifications = await fetchNotifications();

  await Log(
    "backend",
    "info",
    "service",
    `Scoring ${notifications.length} notifications`
  );

  const topNotifications = getTopN(notifications, topN);

  await Log(
    "backend",
    "info",
    "service",
    `Top ${topN} selected. Best score: ${topNotifications[0]?.priorityScore}`
  );

  printPriorityInbox(topNotifications, topN);
}

// ─── Entry Point ──────────────────────────────────────────────────────────────
// Pass topN as CLI argument: ts-node priority_inbox.ts 10
const TOP_N = parseInt(process.argv[2] ?? "10", 10);

runPriorityInbox(TOP_N).catch(async (err) => {
  await Log("backend", "fatal", "service", `Priority Inbox crashed: ${err}`);
  console.error("Fatal error:", err);
  process.exit(1);
});