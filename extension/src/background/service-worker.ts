// Background Service Worker — координатор расширения RKL Check
// State machine: idle → ready → running → paused → completed / error
//
// DOM-манипуляции (заполнение полей, клики) выполняются через
// chrome.scripting.executeScript({ world: 'MAIN' }) — код запускается
// в JavaScript-контексте страницы (тот же мир что и Angular).
// Content script (ISOLATED world) используется только для чтения DOM.

import type {
  Employee,
  CheckResult,
  QueueData,
  Settings,
  GosuslugiStep,
} from '@/types';
import { DEFAULT_SETTINGS } from '@/types';
import type {
  IncomingMessage,
  BaseResponse,
  StatusResponse,
  SettingsResponse,
  StepResponse,
  ReadResultResponse,
  StatusUpdateMessage,
  BackgroundToContentMessage,
} from '@/lib/messages';
import { exportResultsToArrayBuffer } from '@/lib/excel';

// === State ===

let queue: QueueData = {
  employees: [],
  currentIndex: 0,
  results: [],
  state: 'idle',
  startedAt: null,
  pausedAt: null,
};

let settings: Settings = { ...DEFAULT_SETTINGS };
let gosuslugiTabId: number | null = null;
let popupPorts: chrome.runtime.Port[] = [];
let processingLock = false;

// === Helpers ===

function showNotification(title: string, message: string): void {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('src/icons/icon128.png'),
    title,
    message,
  });
}

// === Init ===

chrome.runtime.onInstalled.addListener(() => {
  saveQueue();
});

const stateReady = restoreState();

async function restoreState(): Promise<void> {
  try {
    const data = await chrome.storage.local.get(['queue', 'settings']);
    if (data.queue) {
      queue = data.queue as QueueData;
      if (queue.state === 'running') {
        queue.state = 'paused';
        await saveQueue();
      }
    }
    if (data.settings) {
      settings = { ...DEFAULT_SETTINGS, ...data.settings };
      // Migrate: old default was 4000ms, new recommended minimum is 10000ms
      if (settings.delayBetweenChecks < DEFAULT_SETTINGS.delayBetweenChecks) {
        settings.delayBetweenChecks = DEFAULT_SETTINGS.delayBetweenChecks;
        await chrome.storage.local.set({ settings });
      }
    }
  } catch (err) {
    console.error('RKL Check: state restore error', err);
  }
}

async function saveQueue(): Promise<void> {
  try {
    await chrome.storage.local.set({ queue });
  } catch (err) {
    console.error('RKL Check: state save error', err);
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
    total: queue.employees.length,
    results: queue.results,
    employees: queue.employees,
    startedAt: queue.startedAt,
    pausedAt: queue.pausedAt,
    settings,
  };
}

// === Message handling ===

chrome.runtime.onMessage.addListener(
  (message: IncomingMessage, sender, sendResponse: (r: BaseResponse | StatusResponse) => void) => {
    handleMessage(message, sender)
      .then(sendResponse)
      .catch((err: Error) => {
        console.error('RKL Check: message error', err);
        sendResponse({ ok: false, error: err.message });
      });
    return true;
  }
);

async function handleMessage(
  message: IncomingMessage,
  sender: chrome.runtime.MessageSender
): Promise<BaseResponse | StatusResponse> {
  // Wait for state restoration before handling any message
  await stateReady;

  switch (message.type) {
    case 'GET_STATUS':
      return { ok: true, ...buildStatusUpdate() };

    case 'LOAD_EMPLOYEES':
      return loadEmployees(message.employees);

    case 'START_CHECK':
      return startCheck(message.tabId);

    case 'PAUSE_CHECK':
      return pauseCheck();

    case 'RESUME_CHECK':
      return resumeCheck();

    case 'STOP_CHECK':
      return stopCheck();

    case 'RETRY_ERRORS':
      return retryErrors(message.tabId);

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

    case 'DEBUG_DOM': {
      const csReady = await ensureContentScript(message.tabId);
      if (!csReady.ok) return csReady;
      gosuslugiTabId = message.tabId;
      const debugResp = await sendToContent<StepResponse>({ type: 'DEBUG_DOM' }, 5000);
      // Debug DOM result available in popup
      return { ok: true, debugText: debugResp.debugText } as StepResponse;
    }

    case 'CONTENT_READY':
      // Content script ready
      return { ok: true };

    case 'CONTENT_ERROR':
      console.error('RKL Check: content script error:', message.error);
      return { ok: true };

    default:
      return { ok: false, error: 'Unknown message type' };
  }
}

// === Queue management ===

function loadEmployees(employees: Employee[]): BaseResponse {
  queue.employees = employees;
  queue.currentIndex = 0;
  queue.results = employees.map((emp): CheckResult => {
    // Pre-validate required fields — mark invalid rows as error immediately
    const missing: string[] = [];
    if (!emp.number?.trim()) missing.push('Номер документа');
    if (!emp.issueDate?.trim()) missing.push('Дата выдачи');
    if (!emp.birthDate?.trim()) missing.push('Дата рождения');

    if (missing.length) {
      return {
        status: 'error',
        found: null,
        timestamp: new Date().toISOString(),
        source: null,
        error: `Недостаточно данных: отсутствует ${missing.join(', ')}`,
      };
    }

    return { status: 'pending', found: null, timestamp: null, source: null, error: null };
  });
  queue.state = 'ready';
  queue.startedAt = null;
  queue.pausedAt = null;
  saveQueue();
  notifyPopup();
  return { ok: true };
}

async function startCheck(tabId: number): Promise<BaseResponse> {
  if (queue.state !== 'ready') {
    return { ok: false, error: `Cannot start from state: ${queue.state}` };
  }
  if (!queue.employees.length) {
    return { ok: false, error: 'No employees to check' };
  }

  // Check if there are any pending employees to process
  const hasPending = queue.results.some(r => r.status === 'pending');
  if (!hasPending) {
    queue.state = 'completed';
    await saveQueue();
    notifyPopup();
    return { ok: false, error: 'no_valid_employees' };
  }

  gosuslugiTabId = tabId;

  const csReady = await ensureContentScript(tabId);
  if (!csReady.ok) return csReady;

  queue.state = 'running';
  queue.startedAt = new Date().toISOString();
  queue.pausedAt = null;
  await saveQueue();
  notifyPopup();

  processNext();
  return { ok: true };
}

async function ensureContentScript(tabId: number): Promise<BaseResponse> {
  try {
    const resp = await pingContentScript(tabId);
    if (resp) return { ok: true };
  } catch { /* not responding */ }

  // Inject content script programmatically
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['assets/gosuslugi.ts-loader.js'],
    });
  } catch {
    try {
      const manifest = chrome.runtime.getManifest();
      const csFile = manifest.content_scripts?.[0]?.js?.[0];
      if (csFile) {
        await chrome.scripting.executeScript({ target: { tabId }, files: [csFile] });
      }
    } catch {
      return { ok: false, error: 'Failed to inject content script. Refresh Gosuslugi page (F5).' };
    }
  }

  await sleep(1000);
  try {
    const resp = await pingContentScript(tabId);
    if (resp) return { ok: true };
  } catch { /* still not responding */ }

  return { ok: false, error: 'Content script not responding. Refresh Gosuslugi page (F5).' };
}

function pingContentScript(tabId: number): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('ping timeout')), 2000);
    chrome.tabs.sendMessage(tabId, { type: 'GET_CURRENT_STEP' }, (response) => {
      clearTimeout(timer);
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(!!response?.ok);
    });
  });
}

function pauseCheck(): BaseResponse {
  if (queue.state !== 'running') return { ok: false, error: 'Not running' };
  queue.state = 'paused';
  queue.pausedAt = new Date().toISOString();
  saveQueue();
  notifyPopup();
  return { ok: true };
}

async function resumeCheck(): Promise<BaseResponse> {
  if (queue.state !== 'paused') return { ok: false, error: 'Not paused' };
  queue.state = 'running';
  queue.pausedAt = null;
  await saveQueue();
  notifyPopup();
  processNext();
  return { ok: true };
}

function stopCheck(): BaseResponse {
  queue.state = 'completed';
  saveQueue();
  notifyPopup();
  onCheckComplete();
  return { ok: true };
}

function retryErrors(tabId: number): BaseResponse {
  let errorCount = 0;
  queue.results.forEach((r) => {
    if (r.status === 'error') { r.status = 'pending'; r.error = null; errorCount++; }
  });
  if (!errorCount) return { ok: false, error: 'No errors to retry' };

  const first = queue.results.findIndex((r) => r.status === 'pending');
  queue.currentIndex = first >= 0 ? first : 0;
  gosuslugiTabId = tabId;
  queue.state = 'running';
  queue.pausedAt = null;
  saveQueue();
  notifyPopup();
  processNext();
  return { ok: true };
}

function clearSession(): BaseResponse {
  queue = { employees: [], currentIndex: 0, results: [], state: 'idle', startedAt: null, pausedAt: null };
  gosuslugiTabId = null;
  saveQueue();
  notifyPopup();
  return { ok: true };
}

// === Completion actions (notification + auto-download) ===

async function onCheckComplete(): Promise<void> {
  // Notification
  if (settings.notifyOnComplete) {
    try {
      let found = 0;
      let error = 0;
      for (const r of queue.results) {
        if (r.status === 'found') found++;
        else if (r.status === 'error') error++;
      }
      chrome.notifications.create('rkl-check-complete', {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('src/icons/icon128.png'),
        title: 'РКЛ Check — Проверка завершена',
        message: `Проверено: ${queue.results.length}. Найдено в РКЛ: ${found}. Ошибок: ${error}.`,
      });
    } catch (err) {
      console.error('RKL Check: notification error', err);
    }
  }

  // Auto-download
  if (settings.autoDownload && queue.employees.length > 0) {
    try {
      const { buffer, filename } = exportResultsToArrayBuffer(queue.employees, queue.results);
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const subfolder = (settings.downloadSubfolder || 'RKL_Check')
        .trim()
        .replace(/[\\/:*?"<>|]/g, '_');

      await chrome.downloads.download({
        url,
        filename: `${subfolder}/${filename}`,
        saveAs: false,
      });

      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      console.error('RKL Check: auto-download error', err);
    }
  }
}

// === Check loop ===

async function processNext(): Promise<void> {
  if (processingLock) return;
  processingLock = true;

  try {
    await processLoop();
  } catch (err) {
    console.error('RKL Check: critical loop error', err);
    queue.state = 'error';
    await saveQueue();
    notifyPopup();
  } finally {
    processingLock = false;
  }
}

async function processLoop(): Promise<void> {
  while (queue.state === 'running') {
    const idx = findNextPending();
    if (idx === -1) {
      queue.state = 'completed';
      await saveQueue();
      notifyPopup();
      onCheckComplete();
      return;
    }

    queue.currentIndex = idx;
    notifyPopup();

    const employee = queue.employees[idx];
    const result = await checkOneEmployee(employee);

    queue.results[idx] = result;
    await saveQueue();
    notifyPopup();

    if (queue.state !== 'running') return;

    const delay = settings.delayBetweenChecks + Math.random() * 2000;
    await sleep(delay);
  }
}

function findNextPending(): number {
  for (let i = queue.currentIndex; i < queue.results.length; i++) {
    if (queue.results[i].status === 'pending') return i;
  }
  for (let i = 0; i < queue.currentIndex; i++) {
    if (queue.results[i].status === 'pending') return i;
  }
  return -1;
}

// === Main check logic ===

async function checkOneEmployee(employee: Employee): Promise<CheckResult> {
  const errorResult: CheckResult = { status: 'error', found: null, timestamp: null, source: null, error: null };

  if (!gosuslugiTabId) {
    errorResult.error = 'Gosuslugi tab not found';
    return errorResult;
  }

  let retries = 0;
  while (retries < settings.maxRetries) {
    try {
      // Adaptive step loop — handles any step order
      // Gosuslugi order: intro → birthdate → document → result
      let stepsCompleted = 0;
      let unknownCount = 0;
      const maxSteps = 8; // safety limit for real steps
      const maxUnknown = 15; // loading pages limit (~30s of waiting)

      while (stepsCompleted < maxSteps && unknownCount < maxUnknown) {
        if (queue.state !== 'running') throw new Error('Check stopped');

        const stepResp = await sendToContent<StepResponse>({ type: 'GET_CURRENT_STEP' }, settings.stepTimeout);
        const currentStep = stepResp.step as GosuslugiStep;

        if (currentStep === 'rate_limited') {
          throw new Error('RATE_LIMITED');
        }

        if (currentStep === 'intro') {
          await clickButtonInPage(gosuslugiTabId!, 'Начать');
          await sleep(2000);
          await waitForAnyFormStep();
          stepsCompleted++;
          continue;
        }

        if (currentStep === 'birthdate') {
          await fillBirthdateInPage(gosuslugiTabId!, employee.birthDate);
          await sleep(1000);
          await waitAndClickInPage(gosuslugiTabId!, 'Продолжить', 8000);
          await sleep(1000 + Math.random() * 500);
          await waitForStepChange(currentStep);
          stepsCompleted++;
          continue;
        }

        if (currentStep === 'document') {
          await fillDocumentInPage(gosuslugiTabId!, employee.series || '', employee.number, employee.issueDate);
          await sleep(1000);
          await waitAndClickInPage(gosuslugiTabId!, 'Продолжить', 8000);
          await sleep(1000 + Math.random() * 500);
          await waitForStepChange(currentStep);
          stepsCompleted++;
          continue;
        }

        if (currentStep === 'result') {
          const resultResp = await sendToContent<ReadResultResponse>({ type: 'READ_RESULT' }, 5000);

          try {
            await clickButtonInPage(gosuslugiTabId!, 'Проверить ещё');
          } catch { /* next employee handles navigation */ }
          await sleep(1000);

          return {
            status: resultResp.found ? 'found' : 'not_found',
            found: resultResp.found,
            timestamp: resultResp.timestamp || new Date().toISOString(),
            source: resultResp.source || 'Госуслуги / МВД России',
            error: null,
          };
        }

        // unknown step — wait and retry (page might be loading)
        await sleep(2000);
        unknownCount++;
      }

      throw new Error(
        unknownCount >= maxUnknown
          ? 'Госуслуги не отвечали слишком долго (страница загрузки)'
          : 'Не удалось дойти до результата за допустимое количество шагов'
      );

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);

      // Rate limit — stop completely, employee stays pending
      if (errMsg === 'RATE_LIMITED') {
        queue.state = 'idle';
        await saveQueue();
        notifyPopup();

        showNotification(
          'Проверка остановлена',
          'Госуслуги ограничили частоту запросов. Увеличьте задержку между проверками до рекомендуемых 10 сек и запустите проверку заново.'
        );

        // Return pending — employee not checked, will be retried on next run
        return { status: 'pending', found: null, timestamp: null, source: null, error: null };
      }

      retries++;

      if (retries >= settings.maxRetries) {
        errorResult.error = errMsg;
        return errorResult;
      }

      await sleep(2000);
    }
  }

  return errorResult;
}

// Wait for any form step (not 'unknown', not 'intro') after clicking "Начать"
async function waitForAnyFormStep(): Promise<GosuslugiStep> {
  const timeout = settings.stepTimeout;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (queue.state !== 'running') throw new Error('Check stopped');

    const resp = await sendToContent<StepResponse>({ type: 'GET_CURRENT_STEP' }, 3000);
    if (resp.step === 'rate_limited') throw new Error('RATE_LIMITED');
    if (resp.step && resp.step !== 'unknown' && resp.step !== 'intro') {
      return resp.step as GosuslugiStep;
    }

    await sleep(1000);
  }

  throw new Error(`Timeout waiting for form step (${timeout}ms)`);
}

// Wait for step to change from currentStep to anything else (page transition)
// Phase 1: quick check (stepTimeout) — if step hasn't changed at all, it's a form validation error
// Phase 2: long wait (resultTimeout) — for МВД response during loading
async function waitForStepChange(fromStep: GosuslugiStep): Promise<GosuslugiStep> {
  const startTime = Date.now();
  let sawLoading = false;

  // Phase 1: wait up to stepTimeout for ANY change (including 'unknown'/loading)
  while (Date.now() - startTime < settings.stepTimeout) {
    if (queue.state !== 'running') throw new Error('Check stopped');

    const resp = await sendToContent<StepResponse>({ type: 'GET_CURRENT_STEP' }, 3000);
    if (resp.step === 'rate_limited') throw new Error('RATE_LIMITED');

    if (resp.step === 'unknown') {
      sawLoading = true; // page is transitioning
    }

    if (resp.step && resp.step !== fromStep && resp.step !== 'unknown') {
      return resp.step as GosuslugiStep;
    }

    // If page started loading, move to Phase 2
    if (sawLoading) break;

    await sleep(1000);
  }

  // If step never changed from form step and no loading seen — form validation error
  if (!sawLoading) {
    throw new Error(`Форма не прошла валидацию на шаге "${fromStep}". Проверьте данные сотрудника.`);
  }

  // Phase 2: page is loading (МВД query), wait longer
  while (Date.now() - startTime < settings.resultTimeout) {
    if (queue.state !== 'running') throw new Error('Check stopped');

    const resp = await sendToContent<StepResponse>({ type: 'GET_CURRENT_STEP' }, 3000);
    if (resp.step === 'rate_limited') throw new Error('RATE_LIMITED');
    if (resp.step && resp.step !== fromStep && resp.step !== 'unknown') {
      return resp.step as GosuslugiStep;
    }

    await sleep(1000);
  }

  throw new Error(`Timeout waiting for step change from "${fromStep}" (${settings.resultTimeout}ms)`);
}

// === DOM manipulation via MAIN world ===
// These functions run in the PAGE's JavaScript context (same as Angular).
// All events are naturally trusted and Angular's Zone.js captures them.

async function fillDocumentInPage(tabId: number, series: string, number: string, issueDate: string): Promise<void> {
  // Date field uses lib-date-picker mask — strip dots for digit-by-digit input
  const issueDateDigits = issueDate.replace(/\D/g, '');

  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: async (s: string, n: string, d: string, dDigits: string) => {
      const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

      // Plain text field: execCommand with full value
      function setVal(el: HTMLInputElement, val: string): void {
        el.focus();
        el.select();
        const ok = document.execCommand('insertText', false, val);
        if (ok && el.value === val) { el.blur(); return; }

        const setter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype, 'value'
        )?.set;
        if (setter) { setter.call(el, val); } else { el.value = val; }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.blur();
      }

      // Date field: type digits one by one (mask auto-inserts dots)
      async function setDateVal(el: HTMLInputElement, digits: string, fullDate: string): Promise<void> {
        el.focus();
        el.select();
        document.execCommand('delete');
        await sleep(50);

        for (const char of digits) {
          document.execCommand('insertText', false, char);
          await sleep(30);
        }
        await sleep(200);
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.blur();
        await sleep(100);

        // Fallback: try full date string
        if (el.value !== fullDate) {
          el.focus();
          el.select();
          document.execCommand('delete');
          await sleep(50);
          document.execCommand('insertText', false, fullDate);
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.blur();
          await sleep(100);
        }

        // Last resort: native setter
        if (el.value !== fullDate) {
          const setter = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype, 'value'
          )?.set;
          if (setter) { setter.call(el, fullDate); } else { el.value = fullDate; }
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.blur();
        }
      }

      function findByLabel(texts: string[]): HTMLInputElement | null {
        for (const text of texts) {
          const labels = document.querySelectorAll('label');
          for (const label of labels) {
            if (!label.textContent?.toLowerCase().includes(text.toLowerCase())) continue;
            const input = label.querySelector('input') as HTMLInputElement | null;
            if (input) return input;
            const container = label.closest('[class*="field"], [class*="input"], [class*="form"]');
            const ci = container?.querySelector('input') as HTMLInputElement | null;
            if (ci) return ci;
          }
        }
        return null;
      }

      function findByName(names: string[]): HTMLInputElement | null {
        for (const name of names) {
          const el = document.querySelector<HTMLInputElement>(`input[name*="${name}"]`);
          if (el) return el;
        }
        return null;
      }

      const visible = Array.from(
        document.querySelectorAll<HTMLInputElement>('input[type="text"], input:not([type])')
      ).filter(i => { const r = i.getBoundingClientRect(); return r.width > 0 && r.height > 0; });

      const seriesInput = findByLabel(['серия']) ?? findByName(['series', 'c_series']);
      const numberInput = findByLabel(['номер']) ?? findByName(['number', 'doc_num', 'c_number']) ?? visible[0];
      const dateInput = findByLabel(['дата выдачи']) ?? findByName(['issue', 'doc_date', 'c_issue']) ?? visible[visible.length > 2 ? 2 : 1];

      if (seriesInput && s) setVal(seriesInput, s);
      if (numberInput) setVal(numberInput, n);
      if (dateInput) await setDateVal(dateInput, dDigits, d);

      return { seriesOk: !s || !!seriesInput, numberOk: !!numberInput, dateOk: !!dateInput };
    },
    args: [series, number, issueDate, issueDateDigits],
  });

  const res = results?.[0]?.result as { numberOk: boolean; dateOk: boolean } | undefined;
  if (!res) throw new Error('fillDocument: executeScript returned no results');
  if (!res.numberOk) throw new Error('fillDocument: number input not found');
  if (!res.dateOk) throw new Error('fillDocument: date input not found');
}

async function fillBirthdateInPage(tabId: number, birthDate: string): Promise<void> {
  // lib-date-picker mask expects digits only, auto-inserts dots
  const digits = birthDate.replace(/\D/g, '');

  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: async (digitsStr: string, fullDate: string) => {
      const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

      // Find date input by name or label
      let input: HTMLInputElement | null =
        document.querySelector<HTMLInputElement>('input[name*="birth"]');

      if (!input) {
        const labels = document.querySelectorAll('label');
        for (const label of labels) {
          if (label.textContent?.toLowerCase().includes('дата')) {
            input = label.querySelector('input') as HTMLInputElement | null;
            if (input) break;
          }
        }
      }

      if (!input) {
        const visible = Array.from(
          document.querySelectorAll<HTMLInputElement>('input[type="text"], input:not([type])')
        ).filter(i => { const r = i.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
        input = visible[0] ?? null;
      }

      if (!input) return { found: false, value: '' };

      // Clear field first
      input.focus();
      input.select();
      document.execCommand('delete');
      await sleep(50);

      // Type digits one by one — mask auto-inserts dots
      for (const char of digitsStr) {
        document.execCommand('insertText', false, char);
        await sleep(30);
      }
      await sleep(200);

      // Trigger blur to finalize validation
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.blur();
      await sleep(100);

      // If mask didn't work, try full date with execCommand
      if (input.value !== fullDate) {
        input.focus();
        input.select();
        document.execCommand('delete');
        await sleep(50);
        document.execCommand('insertText', false, fullDate);
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.blur();
        await sleep(100);
      }

      // Last resort: native setter
      if (input.value !== fullDate) {
        const setter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype, 'value'
        )?.set;
        if (setter) { setter.call(input, fullDate); } else { input.value = fullDate; }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.blur();
      }

      return { found: true, value: input.value };
    },
    args: [digits, birthDate],
  });

  const res = results?.[0]?.result as { found: boolean; value: string } | undefined;
  if (!res?.found) throw new Error('fillBirthdate: input not found');
}

async function clickButtonInPage(tabId: number, buttonText: string): Promise<boolean> {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: (text: string) => {
      const buttons = document.querySelectorAll('button, [role="button"], a[href]');
      for (const btn of buttons) {
        if (btn.textContent?.trim().includes(text)) {
          const el = btn as HTMLElement;
          el.removeAttribute('disabled');
          el.classList.remove('disabled');
          el.click();
          return true;
        }
      }
      return false;
    },
    args: [buttonText],
  });

  return results?.[0]?.result ?? false;
}

// Wait for button to become enabled, then click
async function waitAndClickInPage(tabId: number, buttonText: string, timeout = 5000): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: (text: string) => {
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          if (btn.textContent?.trim().includes(text)) {
            return { found: true, disabled: btn.hasAttribute('disabled') };
          }
        }
        return { found: false, disabled: false };
      },
      args: [buttonText],
    });

    const status = results?.[0]?.result;
    if (status?.found && !status.disabled) {
      return clickButtonInPage(tabId, buttonText);
    }

    await sleep(300);
  }

  // Force click even if disabled
  return clickButtonInPage(tabId, buttonText);
}

// === Content script messaging (read-only operations) ===

function sendToContent<T extends BaseResponse>(
  message: BackgroundToContentMessage,
  timeout = 10000
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!gosuslugiTabId) {
      reject(new Error('Gosuslugi tab not found'));
      return;
    }

    const timer = setTimeout(() => {
      reject(new Error(`Content script timeout: ${message.type} (${timeout}ms)`));
    }, timeout);

    chrome.tabs.sendMessage(gosuslugiTabId, message, (response: T | undefined) => {
      clearTimeout(timer);

      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response) {
        reject(new Error(`Empty response from content script: ${message.type}`));
        return;
      }

      if (!response.ok) {
        reject(new Error(response.error || `Content script error: ${message.type}`));
        return;
      }

      resolve(response);
    });
  });
}

// === Utils ===

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
