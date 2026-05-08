// vehicle_maintence_scheduler/index.ts
// Solves the Vehicle Maintenance Scheduling problem using 0/1 Knapsack (DP).
// For each depot, selects the best subset of vehicles to maximise
// total Impact without exceeding the depot's MechanicHours budget.

import Log from "../logging_middleware/logger";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Depot {
  ID: number;
  MechanicHours: number;
}

interface Vehicle {
  TaskID: string;
  Duration: number;
  Impact: number;
}

interface ScheduleResult {
  depotID: number;
  mechanicHours: number;
  selectedTasks: Vehicle[];
  totalDuration: number;
  totalImpact: number;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const BASE_URL = "http://4.224.186.213/evaluation-service";
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || "YOUR_ACCESS_TOKEN_HERE";

const HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${ACCESS_TOKEN}`,
};

// ─── API Helpers ─────────────────────────────────────────────────────────────

async function fetchDepots(): Promise<Depot[]> {
  await Log("backend", "info", "service", "Fetching depots from evaluation service");
  try {
    const res = await fetch(`${BASE_URL}/depots`, { headers: HEADERS });
    if (!res.ok) {
      await Log("backend", "error", "handler", `Depot fetch failed with status: ${res.status}`);
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    await Log("backend", "info", "service", `Successfully fetched ${data.depots.length} depots`);
    return data.depots as Depot[];
  } catch (err) {
    await Log("backend", "fatal", "service", `fetchDepots error: ${err}`);
    throw err;
  }
}

async function fetchVehicles(): Promise<Vehicle[]> {
  await Log("backend", "info", "service", "Fetching vehicles from evaluation service");
  try {
    const res = await fetch(`${BASE_URL}/vehicles`, { headers: HEADERS });
    if (!res.ok) {
      await Log("backend", "error", "handler", `Vehicle fetch failed with status: ${res.status}`);
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    await Log("backend", "info", "service", `Successfully fetched ${data.vehicles.length} vehicles`);
    return data.vehicles as Vehicle[];
  } catch (err) {
    await Log("backend", "fatal", "service", `fetchVehicles error: ${err}`);
    throw err;
  }
}

// ─── 0/1 Knapsack Algorithm ───────────────────────────────────────────────────
/**
 * Dynamic programming 0/1 Knapsack.
 *
 * Problem mapping:
 *   capacity  = depot.MechanicHours  (total hours available)
 *   weight[i] = vehicle.Duration     (hours this task takes)
 *   value[i]  = vehicle.Impact       (score to maximise)
 *
 * Time complexity:  O(n × W)
 * Space complexity: O(n × W)
 *
 * Back-tracking recovers which vehicles were selected.
 */
function knapsack(vehicles: Vehicle[], capacity: number): Vehicle[] {
  const n = vehicles.length;

  // dp[i][w] = best impact using first i vehicles with w hours remaining
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(capacity + 1).fill(0)
  );

  // Fill the DP table
  for (let i = 1; i <= n; i++) {
    const { Duration, Impact } = vehicles[i - 1];
    for (let w = 0; w <= capacity; w++) {
      dp[i][w] = dp[i - 1][w]; // skip vehicle i
      if (Duration <= w) {
        // take vehicle i if it improves the score
        dp[i][w] = Math.max(dp[i][w], dp[i - 1][w - Duration] + Impact);
      }
    }
  }

  // Back-track to find selected vehicles
  const selected: Vehicle[] = [];
  let w = capacity;
  for (let i = n; i >= 1; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {
      selected.push(vehicles[i - 1]);
      w -= vehicles[i - 1].Duration;
    }
  }

  return selected;
}

// ─── Scheduler ───────────────────────────────────────────────────────────────

async function runScheduler(): Promise<void> {
  await Log("backend", "info", "service", "Vehicle Maintenance Scheduler started");

  const [depots, vehicles] = await Promise.all([fetchDepots(), fetchVehicles()]);

  await Log(
    "backend",
    "info",
    "service",
    `Running knapsack for ${depots.length} depots, ${vehicles.length} vehicles`
  );

  const results: ScheduleResult[] = [];

  for (const depot of depots) {
    await Log(
      "backend",
      "debug",
      "service",
      `Depot ${depot.ID}: budget=${depot.MechanicHours}h, running knapsack`
    );

    const selected = knapsack(vehicles, depot.MechanicHours);
    const totalDuration = selected.reduce((s, v) => s + v.Duration, 0);
    const totalImpact = selected.reduce((s, v) => s + v.Impact, 0);

    results.push({ depotID: depot.ID, mechanicHours: depot.MechanicHours, selectedTasks: selected, totalDuration, totalImpact });

    await Log(
      "backend",
      "info",
      "service",
      `Depot ${depot.ID}: selected ${selected.length} tasks, impact=${totalImpact}, hours=${totalDuration}`
    );
  }

  // ─── Print Results ────────────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║     VEHICLE MAINTENANCE SCHEDULE — RESULTS       ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  for (const r of results) {
    console.log(`▶ Depot ${r.depotID}  |  Budget: ${r.mechanicHours}h`);
    console.log(`  Tasks selected : ${r.selectedTasks.length}`);
    console.log(`  Total Duration : ${r.totalDuration}h`);
    console.log(`  Total Impact   : ${r.totalImpact}`);
    console.log("  Selected Tasks :");
    for (const t of r.selectedTasks) {
      console.log(`    ✔ ${t.TaskID}  (${t.Duration}h, impact=${t.Impact})`);
    }
    console.log();
  }

  await Log("backend", "info", "service", "Vehicle Maintenance Scheduler completed");
}

// ─── Entry Point ──────────────────────────────────────────────────────────────
runScheduler().catch(async (err) => {
  await Log("backend", "fatal", "service", `Scheduler crashed: ${err}`);
  console.error("Fatal error:", err);
  process.exit(1);
});