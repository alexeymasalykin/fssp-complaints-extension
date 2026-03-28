// Background Service Worker — FSSP complaint form filler
// Simple manual flow: load complaints → fill current → next/prev

import type { Complaint, QueueData, Settings } from '@/types';
import type {
  IncomingMessage,
  BaseResponse,
  StatusResponse,
  SettingsResponse,
  FillResponse,
  StatusUpdateMessage,
} from '@/lib/messages';
import {
  createEmptyQueue,
  loadComplaints as queueLoad,
  markFilled,
  markError,
  markSubmitted as queueMarkSubmitted,
  moveNext,
  movePrev,
  canFill,
  buildStatusUpdate as queueBuildStatus,
  mergeSettings,
  DEFAULT_SETTINGS,
} from '@/lib/queue';

// === State ===

let queue: QueueData = createEmptyQueue();

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
  return queueBuildStatus(queue, settings);
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
      settings = mergeSettings(settings, message.settings);
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
  queue = queueLoad(queue, complaints);
  saveQueue();
  notifyPopup();
  return { ok: true };
}

const FSSP_FORM_URL = 'https://fssp.gov.ru/welcome/form/appeal';

async function navigateToForm(tabId: number): Promise<void> {
  const tab = await chrome.tabs.get(tabId);
  const url = tab.url ?? '';

  // Already on the form page — no need to navigate
  if (url.includes('/welcome/form/appeal') || url.includes('/appeal')) {
    return;
  }

  // Navigate to form and wait for page load
  await chrome.tabs.update(tabId, { url: FSSP_FORM_URL });
  await waitForTabLoad(tabId);
  // Extra wait for Vue.js SPA to initialize
  await new Promise(r => setTimeout(r, 2000));
}

function waitForTabLoad(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 15000);

    const listener = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function fillCurrent(tabId: number): Promise<BaseResponse> {
  if (!canFill(queue)) {
    return { ok: false, error: `Cannot fill from state: ${queue.state}` };
  }

  const complaint = queue.complaints[queue.currentIndex];
  if (!complaint) {
    return { ok: false, error: 'Invalid index' };
  }

  try {
    await navigateToForm(tabId);

    const response = await sendToContent(tabId, {
      type: 'FILL_FORM',
      complaint,
    });

    queue = markFilled(queue, queue.currentIndex);
    await saveQueue();
    notifyPopup();

    return response;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    queue = markError(queue, queue.currentIndex, errMsg);
    await saveQueue();
    notifyPopup();
    return { ok: false, error: errMsg };
  }
}

async function fillNext(tabId: number): Promise<BaseResponse> {
  const next = moveNext(queue);
  if (!next) return { ok: false, error: 'Последняя жалоба в списке' };
  queue = next;
  await saveQueue();
  notifyPopup();
  return fillCurrent(tabId);
}

async function fillPrev(tabId: number): Promise<BaseResponse> {
  const prev = movePrev(queue);
  if (!prev) return { ok: false, error: 'Первая жалоба в списке' };
  queue = prev;
  await saveQueue();
  notifyPopup();
  return fillCurrent(tabId);
}

function markSubmitted(): BaseResponse {
  queue = queueMarkSubmitted(queue);
  saveQueue();
  notifyPopup();
  return { ok: true };
}

function clearSession(): BaseResponse {
  queue = createEmptyQueue();
  saveQueue();
  notifyPopup();
  return { ok: true };
}

// === Content script messaging ===

async function ensureContentScript(tabId: number): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
  } catch {
    // Content script not injected (tab was open before install/update)
    // Read content script path from manifest and inject programmatically
    const manifest = chrome.runtime.getManifest();
    const csFiles = manifest.content_scripts?.[0]?.js ?? [];
    if (csFiles.length) {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: csFiles,
      });
      await new Promise(r => setTimeout(r, 500));
    }
  }
}

async function sendToContent(tabId: number, message: { type: string; complaint: Complaint }): Promise<FillResponse> {
  await ensureContentScript(tabId);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Content script не отвечает. Обновите страницу ФССП (F5).'));
    }, 60000);

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
