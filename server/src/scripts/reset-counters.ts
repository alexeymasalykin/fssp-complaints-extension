import { initDb, closeDb } from '../db/init.js';
import { resetAllCounters } from '../services/license-service.js';

// Monthly counter reset script — run via cron on the 1st of each month
// Example crontab: 0 0 1 * * cd /path/to/server && npx tsx src/scripts/reset-counters.ts

async function main(): Promise<void> {
  await initDb();
  const count = resetAllCounters();
  console.log(`Reset counters for ${count} license(s).`);
  closeDb();
}

main().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});
