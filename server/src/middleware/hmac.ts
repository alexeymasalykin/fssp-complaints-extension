import { createHmac } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

const HMAC_SECRET = process.env.HMAC_SECRET || 'default-dev-secret';

/**
 * Sign a JSON payload with HMAC-SHA256.
 * Returns hex-encoded signature.
 */
export function signPayload(payload: Record<string, unknown>): string {
  const data = JSON.stringify(payload);
  return createHmac('sha256', HMAC_SECRET).update(data).digest('hex');
}

/**
 * Express middleware that intercepts res.json() to attach HMAC signature.
 * Only signs responses with { ok: true }.
 */
export function hmacMiddleware(req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res);

  res.json = (body: Record<string, unknown>) => {
    if (body && body.ok === true) {
      const signature = signPayload(body);
      body.signature = signature;
    }
    return originalJson(body);
  };

  next();
}
