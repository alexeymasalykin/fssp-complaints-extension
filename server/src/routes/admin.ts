import crypto from 'node:crypto';
import { Router } from 'express';
import { getDb, saveDb } from '../db/init.js';

const router = Router();

const ADMIN_SECRET = process.env.ADMIN_SECRET || '';

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

function generateKey(): string {
  const hex = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `RKL-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
}

// POST /api/admin/gen-key { plan, days? }
router.post('/gen-key', (req, res) => {
  const { plan, days } = req.body;

  if (!plan || !PLAN_LIMITS[plan]) {
    res.status(400).json({ ok: false, error: 'Invalid plan. Use: trial, start, business, corp' });
    return;
  }

  const key = generateKey();
  const limit = PLAN_LIMITS[plan];
  const expDays = Number(days) || PLAN_DAYS[plan];
  const db = getDb();

  db.run(
    `INSERT INTO licenses (key, plan, limit_per_month, expires_at)
     VALUES (?, ?, ?, datetime('now', '+' || ? || ' days'))`,
    [key, plan, limit, expDays],
  );
  saveDb();

  const stmt = db.prepare('SELECT expires_at FROM licenses WHERE key = ?');
  stmt.bind([key]);
  const expires = stmt.step() ? (stmt.getAsObject() as { expires_at: string }).expires_at : '';
  stmt.free();

  console.log(`[admin] Generated key: ${key} (${plan}, ${limit}/mo, ${expDays}d)`);

  res.json({ ok: true, key, plan, limit, expires, days: expDays });
});

// GET /api/admin/keys — list all licenses
router.get('/keys', (_req, res) => {
  const db = getDb();
  const stmt = db.prepare(
    'SELECT key, plan, limit_per_month, used_this_month, expires_at, active, created_at FROM licenses ORDER BY id DESC',
  );
  const keys = [];
  while (stmt.step()) keys.push(stmt.getAsObject());
  stmt.free();
  res.json({ ok: true, keys });
});

// Admin auth middleware
export function adminAuth(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction): void {
  if (!ADMIN_SECRET) {
    res.status(500).json({ ok: false, error: 'ADMIN_SECRET not configured' });
    return;
  }
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token !== ADMIN_SECRET) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return;
  }
  next();
}

export default router;
