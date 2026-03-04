import { getDb, saveDb } from '../db/init.js';

// === Types ===

export interface LicenseRow {
  id: number;
  key: string;
  organization_id: number | null;
  plan: string;
  limit_per_month: number;
  used_this_month: number;
  expires_at: string;
  active: number;
  created_at: string;
  activated_at: string | null;
}

export interface ActivateResult {
  ok: true;
  plan: string;
  limit: number;
  used: number;
  expires: string;
}

export interface ValidateResult {
  ok: true;
  active: boolean;
  plan: string;
  limit: number;
  used: number;
  expires: string;
}

export interface IncrementResult {
  ok: true;
  used: number;
  remaining: number;
}

export class LicenseError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 400,
  ) {
    super(message);
    this.name = 'LicenseError';
  }
}

// === Helpers ===

function getLicenseByKey(key: string): LicenseRow | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM licenses WHERE key = ?');
  stmt.bind([key]);

  if (!stmt.step()) {
    stmt.free();
    return undefined;
  }

  const row = stmt.getAsObject() as unknown as LicenseRow;
  stmt.free();
  return row;
}

// === Service ===

export function activate(key: string): ActivateResult {
  const db = getDb();
  const license = getLicenseByKey(key);

  if (!license) {
    throw new LicenseError('invalid_key', 'License key not found', 404);
  }

  if (new Date(license.expires_at) < new Date()) {
    throw new LicenseError('license_expired', 'License has expired');
  }

  // Activate on first use
  if (!license.active) {
    db.run("UPDATE licenses SET active = 1, activated_at = datetime('now') WHERE id = ?", [license.id]);
    saveDb();
  }

  return {
    ok: true,
    plan: license.plan,
    limit: license.limit_per_month,
    used: license.used_this_month,
    expires: license.expires_at,
  };
}

export function validate(key: string): ValidateResult {
  const license = getLicenseByKey(key);

  if (!license) {
    throw new LicenseError('invalid_key', 'License key not found', 404);
  }

  const expired = new Date(license.expires_at) < new Date();

  return {
    ok: true,
    active: license.active === 1 && !expired,
    plan: license.plan,
    limit: license.limit_per_month,
    used: license.used_this_month,
    expires: license.expires_at,
  };
}

export function increment(key: string, count: number): IncrementResult {
  const db = getDb();
  const license = getLicenseByKey(key);

  if (!license) {
    throw new LicenseError('invalid_key', 'License key not found', 404);
  }

  if (!license.active) {
    throw new LicenseError('license_inactive', 'License is deactivated');
  }

  if (new Date(license.expires_at) < new Date()) {
    throw new LicenseError('license_expired', 'License has expired');
  }

  const newUsed = license.used_this_month + count;
  if (newUsed > license.limit_per_month) {
    throw new LicenseError('limit_exceeded', 'Monthly check limit exceeded');
  }

  db.run('UPDATE licenses SET used_this_month = ? WHERE id = ?', [newUsed, license.id]);
  db.run('INSERT INTO usage_log (license_id, count) VALUES (?, ?)', [license.id, count]);
  saveDb();

  return {
    ok: true,
    used: newUsed,
    remaining: license.limit_per_month - newUsed,
  };
}

export function resetAllCounters(): number {
  const db = getDb();
  db.run('UPDATE licenses SET used_this_month = 0 WHERE used_this_month > 0');
  const changes = db.getRowsModified();
  saveDb();
  return changes;
}
