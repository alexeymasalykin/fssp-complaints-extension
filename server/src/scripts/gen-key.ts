import crypto from 'node:crypto';
import { initDb, getDb, saveDb, closeDb } from '../db/init.js';

// Generate license key in format RKL-XXXX-XXXX-XXXX
function generateKey(): string {
  const hex = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `RKL-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
}

// Usage: npx tsx src/scripts/gen-key.ts <plan> [days]
// Plans: trial (50/mo), start (300/mo), business (1000/mo), corp (5000/mo)
// Default days: trial=14, others=365

const PLAN_LIMITS: Record<string, number> = {
  trial: 50,
  start: 300,
  business: 1000,
  corp: 5000,
};

const PLAN_DAYS: Record<string, number> = {
  trial: 14,
  start: 365,
  business: 365,
  corp: 365,
};

async function main(): Promise<void> {
  const plan = process.argv[2];
  const days = process.argv[3] ? Number(process.argv[3]) : undefined;

  if (!plan || !PLAN_LIMITS[plan]) {
    console.error('Usage: npx tsx src/scripts/gen-key.ts <plan> [days]');
    console.error('Plans: trial, start, business, corp');
    process.exit(1);
  }

  const key = generateKey();
  const limit = PLAN_LIMITS[plan];
  const expDays = days ?? PLAN_DAYS[plan];

  await initDb();
  const db = getDb();

  db.run(
    `INSERT INTO licenses (key, plan, limit_per_month, expires_at)
     VALUES (?, ?, ?, datetime('now', '+' || ? || ' days'))`,
    [key, plan, limit, expDays],
  );
  saveDb();

  // Read back to show expiry date
  const stmt = db.prepare('SELECT expires_at FROM licenses WHERE key = ?');
  stmt.bind([key]);
  const expires = stmt.step() ? (stmt.getAsObject() as { expires_at: string }).expires_at : '?';
  stmt.free();

  console.log(`Key:     ${key}`);
  console.log(`Plan:    ${plan} (${limit}/mo)`);
  console.log(`Expires: ${expires} (${expDays} days)`);

  closeDb();
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
