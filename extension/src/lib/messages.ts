// Message types between extension components
// Discriminated unions for strict typing

import type { Complaint, QueueState, FillResult, Settings } from '@/types';

// === Popup → Background ===

export type PopupMessage =
  | { type: 'GET_STATUS' }
  | { type: 'LOAD_COMPLAINTS'; complaints: Complaint[] }
  | { type: 'FILL_CURRENT'; tabId: number }
  | { type: 'FILL_NEXT'; tabId: number }
  | { type: 'FILL_PREV'; tabId: number }
  | { type: 'MARK_SUBMITTED' }
  | { type: 'CLEAR_SESSION' }
  | { type: 'GET_SETTINGS' }
  | { type: 'SAVE_SETTINGS'; settings: Settings };

// === Background → Content ===

export type BackgroundToContentMessage =
  | { type: 'FILL_FORM'; complaint: Complaint };

// === Content → Background ===

export type ContentToBackgroundMessage =
  | { type: 'CONTENT_READY' };

// === Responses ===

export interface BaseResponse {
  ok: boolean;
  error?: string;
}

export interface StatusResponse extends BaseResponse {
  state: QueueState;
  currentIndex: number;
  total: number;
  results: FillResult[];
  complaints: Complaint[];
  settings: Settings;
}

export interface SettingsResponse extends BaseResponse {
  settings: Settings;
}

export interface FillResponse extends BaseResponse {
  filledFields?: number;
  skippedFields?: string[];
}

// === Background → Popup (via port) ===

export interface StatusUpdateMessage {
  type: 'STATUS_UPDATE';
  state: QueueState;
  currentIndex: number;
  total: number;
  results: FillResult[];
  complaints: Complaint[];
  settings: Settings;
}

// All incoming message types for background
export type IncomingMessage = PopupMessage | ContentToBackgroundMessage;
