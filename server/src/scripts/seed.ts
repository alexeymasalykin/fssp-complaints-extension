import { initDb, getDb, closeDb } from '../db/init.js';

// Seed script: creates test licenses for development

const PLANS = [
  { key: 'TRIAL-TEST-0001', plan: 'trial', limit: 50, days: 14 },
  { key: 'START-TEST-0001', plan: 'start', limit: 300, days: 365 },
  { key: 'BIZ-TEST-0001', plan: 'business', limit: 1000, days: 365 },
  { key: 'CORP-TEST-0001', plan: 'corp', limit: 5000, days: 365 },
];

async function seed(): Promise<void> {
  await initDb();
  const db = getDb();

  // Create test organization
  db.run(
    'INSERT OR IGNORE INTO organizations (id, name, inn, email) VALUES (1, ?, ?, ?)',
    ['Test Organization', '1234567890', 'test@example.com'],
  );

  // Create test licenses
  for (const p of PLANS) {
    db.run(
      `INSERT OR IGNORE INTO licenses (key, organization_id, plan, limit_per_month, expires_at)
       VALUES (?, 1, ?, ?, datetime('now', '+' || ? || ' days'))`,
      [p.key, p.plan, p.limit, p.days],
    );
    console.log(`  ${p.key} — ${p.plan} (${p.limit}/mo, ${p.days}d)`);
  }

  console.log('Seed complete.');
  closeDb();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
