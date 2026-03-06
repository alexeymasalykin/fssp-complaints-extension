// Popup — FSSP complaint form filler UI

import type { Complaint, FillResult, ResultStats, QueueState, Settings } from '@/types';
import type { PopupMessage, StatusUpdateMessage, StatusResponse, BaseResponse, SettingsResponse } from '@/lib/messages';
import { parseExcelFile, validateComplaints } from '@/lib/excel';

// === DOM helpers ===

const $ = (id: string) => document.getElementById(id) as HTMLElement;

const screens = {
  main: $('screen-main'),
  preview: $('screen-preview'),
  filling: $('screen-filling'),
  completed: $('screen-completed'),
  settings: $('screen-settings'),
} as const;

// === State ===

let parsedComplaints: Complaint[] = [];
let lastStatus: StatusUpdateMessage | null = null;
let port: chrome.runtime.Port | null = null;
let settingsReturnScreen: keyof typeof screens = 'main';

// === Init ===

document.addEventListener('DOMContentLoaded', init);

async function init(): Promise<void> {
  bindEvents();
  connectPort();

  const status = await sendMessage<StatusResponse>({ type: 'GET_STATUS' });
  if (status?.ok) {
    lastStatus = status as unknown as StatusUpdateMessage;
    restoreScreen(status);
  } else {
    showScreen('main');
  }
}

// === Port for real-time updates ===

function connectPort(): void {
  port = chrome.runtime.connect({ name: 'popup' });
  port.onMessage.addListener((msg: StatusUpdateMessage) => {
    if (msg.type === 'STATUS_UPDATE') {
      lastStatus = msg;
      handleStatusUpdate(msg);
    }
  });
  port.onDisconnect.addListener(() => { port = null; });
}

function sendMessage<T extends BaseResponse>(message: PopupMessage): Promise<T> {
  return chrome.runtime.sendMessage(message);
}

// === Event binding ===

function bindEvents(): void {
  // Drop zone
  const dropZone = $('drop-zone');
  const fileInput = $('file-input') as HTMLInputElement;

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drop-zone--active');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drop-zone--active'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drop-zone--active');
    const file = (e as DragEvent).dataTransfer?.files[0];
    if (file) handleFile(file);
  });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) handleFile(file);
    fileInput.value = '';
  });

  $('btn-open-fssp').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://fssp.gov.ru/welcome/form/appeal' });
  });

  // Preview
  $('btn-start').addEventListener('click', startSession);
  $('btn-cancel-preview').addEventListener('click', () => {
    parsedComplaints = [];
    showScreen('main');
  });

  // Filling
  $('btn-fill').addEventListener('click', fillCurrent);
  $('btn-submitted').addEventListener('click', markAndNext);
  $('btn-prev').addEventListener('click', fillPrev);
  $('btn-next').addEventListener('click', fillNext);
  $('btn-finish').addEventListener('click', finishSession);

  // Completed
  $('btn-new-session').addEventListener('click', newSession);

  // Settings
  document.querySelectorAll<HTMLButtonElement>('.btn-settings-open').forEach((btn) => {
    btn.addEventListener('click', openSettings);
  });
  $('btn-settings-save').addEventListener('click', saveSettings);
  $('btn-settings-back').addEventListener('click', () => showScreen(settingsReturnScreen));
}

// === Screen switching ===

function showScreen(name: keyof typeof screens): void {
  Object.values(screens).forEach((s) => s.classList.add('hidden'));
  screens[name].classList.remove('hidden');
}

function restoreScreen(status: StatusResponse): void {
  switch (status.state) {
    case 'idle':
      showScreen('main');
      break;
    case 'ready':
    case 'filling':
      parsedComplaints = status.complaints ?? [];
      showScreen('filling');
      updateFillingScreen(status);
      break;
    case 'completed':
      showScreen('completed');
      updateCompleted(status);
      break;
  }
}

// === Excel parsing ===

function handleFile(file: File): void {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const buffer = e.target?.result as ArrayBuffer;
      parsedComplaints = parseExcelFile(buffer);
      showPreview();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Ошибка чтения файла: ${msg}`);
    }
  };
  reader.readAsArrayBuffer(file);
}

// === Preview ===

function showPreview(): void {
  showScreen('preview');

  $('preview-count').textContent = String(parsedComplaints.length);

  const errors = validateComplaints(parsedComplaints);
  const errorsEl = $('validation-errors');
  if (errors.length) {
    errorsEl.textContent = errors.join('; ');
    errorsEl.classList.remove('hidden');
  } else {
    errorsEl.classList.add('hidden');
  }

  const tbody = $('preview-table').querySelector('tbody')!;
  tbody.innerHTML = '';
  const showCount = Math.min(parsedComplaints.length, 10);

  for (let i = 0; i < showCount; i++) {
    const c = parsedComplaints[i];
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td title="${esc(c.orgName)}">${esc(truncate(c.orgName, 15))}</td>
      <td title="${esc(c.territorialBody)}">${esc(truncate(c.territorialBody, 15))}</td>
      <td title="${esc(c.appealText)}">${esc(truncate(c.appealText, 20))}</td>
    `;
    tbody.appendChild(tr);
  }

  const moreEl = $('preview-more');
  if (parsedComplaints.length > showCount) {
    moreEl.textContent = `и ещё ${parsedComplaints.length - showCount}...`;
    moreEl.classList.remove('hidden');
  } else {
    moreEl.classList.add('hidden');
  }
}

// === Session management ===

async function startSession(): Promise<void> {
  const loadResult = await sendMessage<BaseResponse>({
    type: 'LOAD_COMPLAINTS',
    complaints: parsedComplaints,
  });
  if (!loadResult?.ok) {
    alert(`Ошибка загрузки: ${loadResult?.error ?? 'неизвестная ошибка'}`);
    return;
  }
  showScreen('filling');
}

async function fillCurrent(): Promise<void> {
  const tab = await findFsspTab();
  if (!tab) {
    alert('Откройте форму обращения на fssp.gov.ru');
    return;
  }

  $('fill-status').textContent = 'Заполняю форму...';
  const result = await sendMessage<BaseResponse>({ type: 'FILL_CURRENT', tabId: tab.id! });

  if (result?.ok) {
    $('fill-status').textContent = 'Форма заполнена. Проверьте данные, введите капчу и нажмите «Подать обращение».';
    $('fill-status').style.color = '#16A34A';
  } else {
    $('fill-status').textContent = `Ошибка: ${result?.error ?? 'неизвестная'}`;
    $('fill-status').style.color = '#DC2626';
  }
}

async function markAndNext(): Promise<void> {
  await sendMessage({ type: 'MARK_SUBMITTED' });

  const tab = await findFsspTab();
  if (!tab) {
    alert('Откройте форму обращения на fssp.gov.ru');
    return;
  }

  const result = await sendMessage<BaseResponse>({ type: 'FILL_NEXT', tabId: tab.id! });
  if (!result?.ok && result?.error === 'Последняя жалоба в списке') {
    await sendMessage({ type: 'CLEAR_SESSION' });
    showScreen('completed');
  }
  $('fill-status').textContent = '';
  $('fill-status').style.color = '';
}

async function fillNext(): Promise<void> {
  const tab = await findFsspTab();
  if (!tab) { alert('Откройте форму обращения на fssp.gov.ru'); return; }
  $('fill-status').textContent = '';
  $('fill-status').style.color = '';
  await sendMessage<BaseResponse>({ type: 'FILL_NEXT', tabId: tab.id! });
}

async function fillPrev(): Promise<void> {
  const tab = await findFsspTab();
  if (!tab) { alert('Откройте форму обращения на fssp.gov.ru'); return; }
  $('fill-status').textContent = '';
  $('fill-status').style.color = '';
  await sendMessage<BaseResponse>({ type: 'FILL_PREV', tabId: tab.id! });
}

async function finishSession(): Promise<void> {
  await sendMessage({ type: 'CLEAR_SESSION' });
  parsedComplaints = [];
  showScreen('main');
}

async function newSession(): Promise<void> {
  await sendMessage({ type: 'CLEAR_SESSION' });
  parsedComplaints = [];
  showScreen('main');
}

// === UI updates ===

function handleStatusUpdate(status: StatusUpdateMessage): void {
  switch (status.state) {
    case 'ready':
    case 'filling':
      showScreen('filling');
      updateFillingScreen(status);
      break;
    case 'completed':
      showScreen('completed');
      updateCompleted(status);
      break;
  }
}

interface StatusLike {
  state: QueueState;
  currentIndex: number;
  total: number;
  results: FillResult[];
  complaints: Complaint[];
}

function updateFillingScreen(status: StatusLike): void {
  const { currentIndex, total, complaints } = status;
  const num = currentIndex + 1;

  $('current-num').textContent = String(num);
  $('total-num').textContent = String(total);

  const pct = total > 0 ? (num / total) * 100 : 0;
  $('progress-fill').style.width = `${pct}%`;

  const complaint = complaints[currentIndex];
  if (complaint) {
    $('info-org').textContent = complaint.orgName || '—';
    $('info-territory').textContent = complaint.territorialBody || '—';
    $('info-text').textContent = truncate(complaint.appealText || '—', 80);
  }

  ($('btn-prev') as HTMLButtonElement).disabled = currentIndex <= 0;
  ($('btn-next') as HTMLButtonElement).disabled = currentIndex >= total - 1;
}

function updateCompleted(status: StatusLike): void {
  const stats = countResults(status.results);
  $('result-total').textContent = String(stats.total);
  $('result-submitted').textContent = String(stats.submitted);
  $('result-errors').textContent = String(stats.error);
}

// === Settings ===

async function openSettings(): Promise<void> {
  for (const [name, el] of Object.entries(screens)) {
    if (!el.classList.contains('hidden')) {
      settingsReturnScreen = name as keyof typeof screens;
      break;
    }
  }

  const resp = await sendMessage<SettingsResponse>({ type: 'GET_SETTINGS' });
  if (resp?.ok) {
    ($('setting-notify') as HTMLInputElement).checked = resp.settings.notifyOnComplete;
  }
  showScreen('settings');
}

async function saveSettings(): Promise<void> {
  const updated: Settings = {
    notifyOnComplete: ($('setting-notify') as HTMLInputElement).checked,
  };
  await sendMessage({ type: 'SAVE_SETTINGS', settings: updated });
  showScreen(settingsReturnScreen);
}

// === Navigation ===

function findFsspTab(): Promise<chrome.tabs.Tab | null> {
  return new Promise((resolve) => {
    chrome.tabs.query({ url: 'https://fssp.gov.ru/*' }, (tabs) => {
      resolve(tabs?.length ? tabs[0] : null);
    });
  });
}

// === Utils ===

function countResults(results: FillResult[]): ResultStats {
  const stats: ResultStats = { total: results.length, filled: 0, submitted: 0, error: 0, pending: 0 };
  for (const r of results) {
    if (r.status === 'submitted') stats.submitted++;
    else if (r.status === 'filled') stats.filled++;
    else if (r.status === 'error') stats.error++;
    else stats.pending++;
  }
  return stats;
}

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? `${str.slice(0, maxLen - 1)}…` : str;
}

function esc(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
