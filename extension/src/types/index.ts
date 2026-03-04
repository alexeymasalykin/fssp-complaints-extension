// Общие типы расширения RKL Check

// === Данные сотрудника ===

export interface Employee {
  index: number;
  number: string;
  issueDate: string;  // ДД.ММ.ГГГГ
  birthDate: string;  // ДД.ММ.ГГГГ
  series: string;
  name: string;
}

// === Результат проверки ===

export type CheckStatus = 'pending' | 'not_found' | 'found' | 'error';

export interface CheckResult {
  status: CheckStatus;
  found: boolean | null;
  timestamp: string | null;
  source: string | null;
  error: string | null;
}

// === Состояние очереди ===

export type QueueState = 'idle' | 'ready' | 'running' | 'paused' | 'completed' | 'error';

export interface QueueData {
  employees: Employee[];
  currentIndex: number;
  results: CheckResult[];
  state: QueueState;
  startedAt: string | null;
  pausedAt: string | null;
}

// === Настройки ===

export interface Settings {
  delayBetweenChecks: number;
  resultTimeout: number;
  stepTimeout: number;
  maxRetries: number;
  autoDownload: boolean;
  downloadSubfolder: string;
  notifyOnComplete: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  delayBetweenChecks: 10000,
  resultTimeout: 120000,
  stepTimeout: 10000,
  maxRetries: 3,
  autoDownload: false,
  downloadSubfolder: 'RKL_Check',
  notifyOnComplete: true,
};

// === Лицензия ===

export type LicensePlan = 'trial' | 'start' | 'business' | 'corp';

export const PLAN_LABELS: Record<LicensePlan, string> = {
  trial: 'Пробный',
  start: 'Старт',
  business: 'Бизнес',
  corp: 'Корпоративный',
};

export interface LicenseInfo {
  key: string;
  plan: LicensePlan;
  limit: number;
  used: number;
  expires: string;
  active: boolean;
  lastValidated: string | null;
}

// Server response types
export interface LicenseActivateResponse {
  ok: true;
  plan: LicensePlan;
  limit: number;
  used: number;
  expires: string;
  signature: string;
}

export interface LicenseValidateResponse {
  ok: true;
  active: boolean;
  plan: LicensePlan;
  limit: number;
  used: number;
  expires: string;
  signature: string;
}

export interface LicenseIncrementResponse {
  ok: true;
  used: number;
  remaining: number;
  signature: string;
}

export interface LicenseErrorResponse {
  ok: false;
  code: string;
  message: string;
}

// === Шаги формы Госуслуг ===

export type GosuslugiStep = 'intro' | 'document' | 'birthdate' | 'result' | 'rate_limited' | 'unknown';

// === Статистика результатов ===

export interface ResultStats {
  total: number;
  notFound: number;
  found: number;
  error: number;
  pending: number;
}
