// Background Service Worker — FSSP complaint form filler
// Simple manual flow: load complaints → fill current → next/prev

import type { Complaint, FillResult, QueueData, Settings } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';
import type {
  IncomingMessage,
  BaseResponse,
  StatusResponse,
  SettingsResponse,
  FillResponse,
  StatusUpdateMessage,
} from '@/lib/messages';

// === State ===

let queue: QueueData = {
  complaints: [],
  currentIndex: 0,
  results: [],
  state: 'idle',
};

let settings: Settings = { ...DEFAULT_SETTINGS };
let popupPorts: chrome.runtime.Port[] = [];

// === Init ===

chrome.runtime.onInstalled.addListener(() => {
  saveQueue();
});

const stateReady = restoreState();

async function restoreState(): Promise<void> {
  try {
    const data = await chrome.storage.local.get(['queue', 'settings']);
    if (data.queue) queue = data.queue as QueueData;
    if (data.settings) settings = { ...DEFAULT_SETTINGS, ...data.settings };
  } catch (err) {
    console.error('FSSP: state restore error', err);
  }
}

async function saveQueue(): Promise<void> {
  try {
    await chrome.storage.local.set({ queue });
  } catch (err) {
    console.error('FSSP: state save error', err);
  }
}

// === Popup port ===

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'popup') return;
  popupPorts.push(port);
  port.onDisconnect.addListener(() => {
    popupPorts = popupPorts.filter((p) => p !== port);
  });
});

function notifyPopup(): void {
  const msg = buildStatusUpdate();
  for (const port of popupPorts) {
    try { port.postMessage(msg); } catch { /* disconnected */ }
  }
}

function buildStatusUpdate(): StatusUpdateMessage {
  return {
    type: 'STATUS_UPDATE',
    state: queue.state,
    currentIndex: queue.currentIndex,
    total: queue.complaints.length,
    results: queue.results,
    complaints: queue.complaints,
    settings,
  };
}

// === Message handling ===

chrome.runtime.onMessage.addListener(
  (message: IncomingMessage, _sender, sendResponse: (r: BaseResponse | StatusResponse) => void) => {
    handleMessage(message)
      .then(sendResponse)
      .catch((err: Error) => {
        console.error('FSSP: message error', err);
        sendResponse({ ok: false, error: err.message });
      });
    return true;
  }
);

async function handleMessage(message: IncomingMessage): Promise<BaseResponse | StatusResponse> {
  await stateReady;

  switch (message.type) {
    case 'GET_STATUS':
      return { ok: true, ...buildStatusUpdate() };

    case 'LOAD_COMPLAINTS':
      return loadComplaints(message.complaints);

    case 'FILL_CURRENT':
      return fillCurrent(message.tabId);

    case 'FILL_NEXT':
      return fillNext(message.tabId);

    case 'FILL_PREV':
      return fillPrev(message.tabId);

    case 'MARK_SUBMITTED':
      return markSubmitted();

    case 'CLEAR_SESSION':
      return clearSession();

    case 'GET_SETTINGS':
      return { ok: true, settings } as SettingsResponse;

    case 'SAVE_SETTINGS': {
      settings = { ...settings, ...message.settings };
      await chrome.storage.local.set({ settings });
      notifyPopup();
      return { ok: true };
    }

    case 'CONTENT_READY':
      return { ok: true };

    default:
      return { ok: false, error: 'Unknown message type' };
  }
}

// === Complaint management ===

function loadComplaints(complaints: Complaint[]): BaseResponse {
  queue.complaints = complaints;
  queue.currentIndex = 0;
  queue.results = complaints.map((): FillResult => ({
    status: 'pending',
    timestamp: null,
    error: null,
  }));
  queue.state = 'ready';
  saveQueue();
  notifyPopup();
  return { ok: true };
}

async function fillCurrent(tabId: number): Promise<BaseResponse> {
  if (queue.state !== 'ready' && queue.state !== 'filling') {
    return { ok: false, error: `Cannot fill from state: ${queue.state}` };
  }
  if (!queue.complaints.length) {
    return { ok: false, error: 'No complaints loaded' };
  }

  const complaint = queue.complaints[queue.currentIndex];
  if (!complaint) {
    return { ok: false, error: 'Invalid index' };
  }

  try {
    const response = await sendToContent(tabId, {
      type: 'FILL_FORM',
      complaint,
    });

    queue.state = 'filling';
    queue.results[queue.currentIndex] = {
      status: 'filled',
      timestamp: new Date().toISOString(),
      error: null,
    };
    await saveQueue();
    notifyPopup();

    return response;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    queue.results[queue.currentIndex] = {
      status: 'error',
      timestamp: new Date().toISOString(),
      error: errMsg,
    };
    await saveQueue();
    notifyPopup();
    return { ok: false, error: errMsg };
  }
}

async function fillNext(tabId: number): Promise<BaseResponse> {
  if (queue.currentIndex < queue.complaints.length - 1) {
    queue.currentIndex++;
    await saveQueue();
    notifyPopup();
    return fillCurrent(tabId);
  }
  return { ok: false, error: 'Последняя жалоба в списке' };
}

async function fillPrev(tabId: number): Promise<BaseResponse> {
  if (queue.currentIndex > 0) {
    queue.currentIndex--;
    await saveQueue();
    notifyPopup();
    return fillCurrent(tabId);
  }
  return { ok: false, error: 'Первая жалоба в списке' };
}

function markSubmitted(): BaseResponse {
  if (queue.currentIndex < queue.results.length) {
    queue.results[queue.currentIndex] = {
      status: 'submitted',
      timestamp: new Date().toISOString(),
      error: null,
    };

    // Check if all done
    const allDone = queue.results.every(r => r.status === 'submitted' || r.status === 'error');
    if (allDone) {
      queue.state = 'completed';
    }

    saveQueue();
    notifyPopup();
  }
  return { ok: true };
}

function clearSession(): BaseResponse {
  queue = { complaints: [], currentIndex: 0, results: [], state: 'idle' };
  saveQueue();
  notifyPopup();
  return { ok: true };
}

// === Content script messaging ===

function sendToContent(tabId: number, message: { type: string; complaint: Complaint }): Promise<FillResponse> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Content script не отвечает. Обновите страницу ФССП (F5).'));
    }, 10000);

    chrome.tabs.sendMessage(tabId, message, (response: FillResponse | undefined) => {
      clearTimeout(timer);

      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response) {
        reject(new Error('Пустой ответ от content script'));
        return;
      }

      if (!response.ok) {
        reject(new Error(response.error || 'Content script error'));
        return;
      }

      resolve(response);
    });
  });
}
