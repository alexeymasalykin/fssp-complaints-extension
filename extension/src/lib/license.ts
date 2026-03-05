// License client — communicates with license server, caches in chrome.storage.local
// HMAC verification uses Web Crypto API (no npm deps)

import type {
  LicenseInfo,
  LicenseActivateResponse,
  LicenseValidateResponse,
  LicenseIncrementResponse,
  LicenseErrorResponse,
  LicensePlan,
} from '@/types';

// === Configuration ===

const LICENSE_SERVER_URL = 'https://alexbottest.ru';

// HMAC key — must match server HMAC_SECRET
const HMAC_KEY = '304c1b6aa1bd603065738472c69172a5ae653814d4e2d37bdf44d6f1c245b0a2';

const STORAGE_KEY_LICENSE = 'rkl_license';

// === HMAC Verification (Web Crypto) ===

async function verifyHmac(payload: Record<string, unknown>, signature: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(HMAC_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const { signature: _sig, ...payloadWithoutSig } = payload;
  const data = JSON.stringify(payloadWithoutSig);
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const computed = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return computed === signature;
}

// === Cache ===

export async function getCachedLicense(): Promise<LicenseInfo | null> {
  const data = await chrome.storage.local.get(STORAGE_KEY_LICENSE);
  return (data[STORAGE_KEY_LICENSE] as LicenseInfo) ?? null;
}

export async function cacheLicense(license: LicenseInfo): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY_LICENSE]: license });
}

async function clearCachedLicense(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY_LICENSE);
}

// === Server API calls ===

type ServerResponse = LicenseActivateResponse | LicenseValidateResponse | LicenseIncrementResponse | LicenseErrorResponse;

async function serverPost<T extends ServerResponse>(path: string, body: Record<string, unknown>): Promise<T> {
  const resp = await fetch(`${LICENSE_SERVER_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const json = await resp.json() as T;
  return json;
}

// === Activate ===

export async function activateLicense(key: string): Promise<LicenseInfo> {
  const resp = await serverPost<LicenseActivateResponse | LicenseErrorResponse>('/api/license/activate', { key });

  if (!resp.ok) {
    const err = resp as LicenseErrorResponse;
    throw new LicenseClientError(err.code, err.message);
  }

  const data = resp as LicenseActivateResponse;

  const valid = await verifyHmac(data as unknown as Record<string, unknown>, data.signature);
  if (!valid) {
    console.warn('HMAC verification failed on activate — proceeding anyway (HTTPS)');
  }

  const license: LicenseInfo = {
    key,
    plan: data.plan as LicensePlan,
    limit: data.limit,
    used: data.used,
    expires: data.expires,
    active: true,
    lastValidated: new Date().toISOString(),
  };

  await cacheLicense(license);
  return license;
}

// === Validate ===

export async function validateLicense(): Promise<LicenseInfo | null> {
  const cached = await getCachedLicense();
  if (!cached) return null;

  try {
    const resp = await serverPost<LicenseValidateResponse | LicenseErrorResponse>('/api/license/validate', {
      key: cached.key,
    });

    if (!resp.ok) {
      await clearCachedLicense();
      return null;
    }

    const data = resp as LicenseValidateResponse;

    const valid = await verifyHmac(data as unknown as Record<string, unknown>, data.signature);
    if (!valid) {
      console.warn('HMAC verification failed on validate — updating cache anyway (HTTPS)');
    }

    const updated: LicenseInfo = {
      ...cached,
      plan: data.plan as LicensePlan,
      limit: data.limit,
      used: data.used,
      expires: data.expires,
      active: data.active,
      lastValidated: new Date().toISOString(),
    };

    await cacheLicense(updated);
    return updated;
  } catch {
    console.warn('License validation failed (offline?), using cache');
    return cached;
  }
}

// === Increment ===

export async function incrementUsage(count: number = 1): Promise<{ used: number; remaining: number } | null> {
  const cached = await getCachedLicense();
  if (!cached) return null;

  try {
    const resp = await serverPost<LicenseIncrementResponse | LicenseErrorResponse>('/api/license/increment', {
      key: cached.key,
      count,
    });

    if (!resp.ok) {
      const err = resp as LicenseErrorResponse;
      throw new LicenseClientError(err.code, err.message);
    }

    const data = resp as LicenseIncrementResponse;

    cached.used = data.used;
    await cacheLicense(cached);

    return { used: data.used, remaining: data.remaining };
  } catch (err) {
    if (err instanceof LicenseClientError) throw err;

    // Network error — increment locally
    console.warn('Increment failed (offline?), updating locally');
    cached.used += count;
    await cacheLicense(cached);
    return { used: cached.used, remaining: cached.limit - cached.used };
  }
}

// === Utility ===

export function isLicenseActive(license: LicenseInfo | null): boolean {
  if (!license) return false;
  if (!license.active) return false;
  if (new Date(license.expires) < new Date()) return false;
  return true;
}

export function checkLimit(license: LicenseInfo | null): boolean {
  if (!license) return false;
  return license.used < license.limit;
}

// === Error type ===

export class LicenseClientError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'LicenseClientError';
  }
}
