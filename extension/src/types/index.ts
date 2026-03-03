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
}

export const DEFAULT_SETTINGS: Settings = {
  delayBetweenChecks: 4000,
  resultTimeout: 120000,
  stepTimeout: 10000,
  maxRetries: 3,
};

// === Лицензия (заглушка для MVP) ===

export interface LicenseInfo {
  key: string;
  deviceId: string;
  plan: string;
  limit: number;
  used: number;
  expires: string;
  active: boolean;
}

// === Шаги формы Госуслуг ===

export type GosuslugiStep = 'intro' | 'document' | 'birthdate' | 'result' | 'unknown';

// === Статистика результатов ===

export interface ResultStats {
  total: number;
  notFound: number;
  found: number;
  error: number;
  pending: number;
}
