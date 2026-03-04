import { getDb, saveDb } from '../db/init.js';
import { resetAllCounters } from './license-service.js';

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Get the year-month string (YYYY-MM) from a date or ISO string.
 */
function yearMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Check if monthly counters need resetting and reset if so.
 * Compares current month with the stored last_reset_at month.
 */
export function checkAndResetCounters(): void {
  const db = getDb();

  const stmt = db.prepare("SELECT value FROM settings WHERE key = 'last_reset_at'");
  let lastResetAt: string | null = null;

  if (stmt.step()) {
    const row = stmt.getAsObject() as { value: string };
    lastResetAt = row.value;
  }
  stmt.free();

  const now = new Date();
  const currentMonth = yearMonth(now);
  const lastResetMonth = lastResetAt ? yearMonth(new Date(lastResetAt + 'Z')) : null;

  if (lastResetMonth === currentMonth) {
    return; // Already reset this month
  }

  const count = resetAllCounters();
  db.run(
    "INSERT OR REPLACE INTO settings (key, value) VALUES ('last_reset_at', datetime('now'))",
  );
  saveDb();

  console.log(`[scheduler] Monthly reset: ${count} license(s), prev=${lastResetMonth}, now=${currentMonth}`);
}

/**
 * Start the scheduler: run check immediately, then every hour.
 */
export function startScheduler(): void {
  checkAndResetCounters();
  intervalId = setInterval(checkAndResetCounters, CHECK_INTERVAL_MS);
  console.log('[scheduler] Started (check interval: 1h)');
}

/**
 * Stop the scheduler.
 */
export function stopScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
