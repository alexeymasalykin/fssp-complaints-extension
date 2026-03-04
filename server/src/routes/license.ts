import { Router } from 'express';
import { activate, validate, increment, LicenseError } from '../services/license-service.js';

const router = Router();

// POST /api/license/activate
router.post('/activate', (req, res) => {
  try {
    const { key, deviceId } = req.body;

    if (!key || !deviceId) {
      res.status(400).json({ ok: false, code: 'missing_params', message: 'key and deviceId are required' });
      return;
    }

    const result = activate(String(key).trim(), String(deviceId).trim());
    res.json(result);
  } catch (err) {
    handleError(err, res);
  }
});

// POST /api/license/validate
router.post('/validate', (req, res) => {
  try {
    const { key, deviceId } = req.body;

    if (!key || !deviceId) {
      res.status(400).json({ ok: false, code: 'missing_params', message: 'key and deviceId are required' });
      return;
    }

    const result = validate(String(key).trim(), String(deviceId).trim());
    res.json(result);
  } catch (err) {
    handleError(err, res);
  }
});

// POST /api/license/increment
router.post('/increment', (req, res) => {
  try {
    const { key, deviceId, count } = req.body;

    if (!key || !deviceId) {
      res.status(400).json({ ok: false, code: 'missing_params', message: 'key and deviceId are required' });
      return;
    }

    const numCount = Number(count) || 1;
    if (numCount < 1 || numCount > 1000) {
      res.status(400).json({ ok: false, code: 'invalid_count', message: 'count must be 1-1000' });
      return;
    }

    const result = increment(String(key).trim(), String(deviceId).trim(), numCount);
    res.json(result);
  } catch (err) {
    handleError(err, res);
  }
});

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof LicenseError) {
    res.status(err.status).json({ ok: false, code: err.code, message: err.message });
    return;
  }
  console.error('Unexpected error:', err);
  res.status(500).json({ ok: false, code: 'internal_error', message: 'Internal server error' });
}

export default router;
