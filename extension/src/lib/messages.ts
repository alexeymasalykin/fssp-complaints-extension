// Типы сообщений между компонентами расширения
// Дискриминированные union для строгой типизации

import type { Employee, QueueState, CheckResult, Settings } from '@/types';

// === Popup → Background ===

export type PopupMessage =
  | { type: 'GET_STATUS' }
  | { type: 'LOAD_EMPLOYEES'; employees: Employee[] }
  | { type: 'START_CHECK'; tabId: number }
  | { type: 'PAUSE_CHECK' }
  | { type: 'RESUME_CHECK' }
  | { type: 'STOP_CHECK' }
  | { type: 'RETRY_ERRORS'; tabId: number }
  | { type: 'CLEAR_SESSION' }
  | { type: 'DEBUG_DOM'; tabId: number };

// === Background → Content ===

export type BackgroundToContentMessage =
  | { type: 'GET_CURRENT_STEP' }
  | { type: 'CLICK_START' }
  | { type: 'FILL_DOCUMENT'; series: string; number: string; issueDate: string }
  | { type: 'FILL_BIRTHDATE'; birthDate: string }
  | { type: 'READ_RESULT' }
  | { type: 'CLICK_CHECK_MORE' }
  | { type: 'DEBUG_DOM' };

// === Content → Background ===

export type ContentToBackgroundMessage =
  | { type: 'CONTENT_READY' }
  | { type: 'CONTENT_ERROR'; error: string; step?: string };

// === Ответы ===

export interface BaseResponse {
  ok: boolean;
  error?: string;
}

export interface StatusResponse extends BaseResponse {
  state: QueueState;
  currentIndex: number;
  total: number;
  results: CheckResult[];
  employees: Employee[];
  startedAt: string | null;
  pausedAt: string | null;
  settings: Settings;
}

export interface StepResponse extends BaseResponse {
  step: string;
  debugText?: string; // Фрагмент текста страницы при unknown шаге (для диагностики)
}

export interface ReadResultResponse extends BaseResponse {
  found: boolean;
  timestamp: string;
  source: string;
}

// === Background → Popup (через port) ===

export interface StatusUpdateMessage {
  type: 'STATUS_UPDATE';
  state: QueueState;
  currentIndex: number;
  total: number;
  results: CheckResult[];
  employees: Employee[];
  startedAt: string | null;
  pausedAt: string | null;
  settings: Settings;
}

// Все типы входящих сообщений для background
export type IncomingMessage = PopupMessage | ContentToBackgroundMessage;
