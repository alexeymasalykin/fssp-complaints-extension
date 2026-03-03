// Модуль лицензирования — заглушка для MVP
// В Фазе 2 будет заменён на реальную проверку через сервер

import type { LicenseInfo } from '@/types';

// MVP: лицензия всегда активна, без ограничений
const MVP_LICENSE: LicenseInfo = {
  key: 'MVP-MODE',
  deviceId: 'local',
  plan: 'mvp',
  limit: Infinity,
  used: 0,
  expires: '2099-12-31T23:59:59Z',
  active: true,
};

export function getLicense(): LicenseInfo {
  return { ...MVP_LICENSE };
}

export function isLicenseActive(): boolean {
  return true;
}

export function checkLimit(currentUsed: number): boolean {
  return currentUsed < MVP_LICENSE.limit;
}
