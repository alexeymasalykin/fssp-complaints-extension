// Popup — управление интерфейсом расширения RKL Check

import type { Employee, CheckResult, ResultStats, QueueState, Settings, LicenseInfo } from '@/types';
import { PLAN_LABELS, type LicensePlan } from '@/types';
import type { PopupMessage, StatusUpdateMessage, StatusResponse, BaseResponse, SettingsResponse, LicenseResponse } from '@/lib/messages';
import { parseExcelFile, validateEmployees, exportResultsToExcel } from '@/lib/excel';

// === Получение DOM-элементов ===

const $ = (id: string) => document.getElementById(id) as HTMLElement;

const screens = {
  license: $('screen-license'),
  main: $('screen-main'),
  preview: $('screen-preview'),
  progress: $('screen-progress'),
  results: $('screen-results'),
  settings: $('screen-settings'),
} as const;

// === Состояние popup ===

let currentFilter: 'all' | 'found' | 'error' = 'all';
let parsedEmployees: Employee[] = [];
let lastStatus: StatusUpdateMessage | null = null;
let port: chrome.runtime.Port | null = null;
let settingsReturnScreen: keyof typeof screens = 'main';

// === Инициализация ===

document.addEventListener('DOMContentLoaded', init);

async function init(): Promise<void> {
  bindEvents();
  connectPort();

  const status = await sendMessage<StatusResponse>({ type: 'GET_STATUS' });
  if (status?.ok) {
    lastStatus = status as unknown as StatusUpdateMessage;
    restoreScreen(status);
  } else {
    showScreen('license');
  }
}

// === Port для real-time обновлений ===

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

// === Отправка сообщений в background ===

function sendMessage<T extends BaseResponse>(message: PopupMessage): Promise<T> {
  return chrome.runtime.sendMessage(message);
}

// === Привязка событий ===

function bindEvents(): void {
  // Экран лицензии
  $('btn-activate').addEventListener('click', handleActivateLicense);
  $('license-key-input').addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') handleActivateLicense();
  });
  $('btn-license-back').addEventListener('click', () => showScreen('main'));
  $('license-bar').addEventListener('click', openChangeLicense);

  // Drag-drop зона
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

  $('btn-open-gosuslugi').addEventListener('click', openGosuslugi);

  // Предпросмотр
  $('btn-start-check').addEventListener('click', startCheck);
  $('btn-cancel-preview').addEventListener('click', () => {
    parsedEmployees = [];
    showScreen('main');
  });

  // Прогресс
  $('btn-pause').addEventListener('click', () => sendMessage({ type: 'PAUSE_CHECK' }));
  $('btn-resume').addEventListener('click', () => sendMessage({ type: 'RESUME_CHECK' }));
  $('btn-stop').addEventListener('click', stopCheck);

  // Результаты
  $('btn-export').addEventListener('click', exportResults);
  $('btn-retry-errors').addEventListener('click', retryErrors);
  $('btn-new-check').addEventListener('click', newCheck);

  // Settings
  document.querySelectorAll<HTMLButtonElement>('.btn-settings-open').forEach((btn) => {
    btn.addEventListener('click', openSettings);
  });
  $('btn-settings-save').addEventListener('click', saveSettings);
  $('btn-settings-back').addEventListener('click', () => showScreen(settingsReturnScreen));

  $('setting-auto-download').addEventListener('change', () => {
    const checked = ($('setting-auto-download') as HTMLInputElement).checked;
    $('setting-folder-row').classList.toggle('hidden', !checked);
  });

  $('setting-delay').addEventListener('input', () => {
    const val = Number(($('setting-delay') as HTMLInputElement).value);
    $('delay-value-hint').textContent = `${(val / 1000).toFixed(1)} сек`;
  });

  // Фильтры
  document.querySelectorAll<HTMLButtonElement>('.filter-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = (tab.dataset.filter ?? 'all') as typeof currentFilter;
      renderResultsTable();
    });
  });
}

// === Переключение экранов ===

function showScreen(name: keyof typeof screens): void {
  Object.values(screens).forEach((s) => s.classList.add('hidden'));
  screens[name].classList.remove('hidden');
}

function restoreScreen(status: StatusResponse): void {
  // Update license UI if available
  if (status.license) updateLicenseUI(status.license);

  // If no active license, show activation screen (first time — no back button)
  if (!status.license || !status.license.active) {
    $('btn-license-back').classList.add('hidden');
    $('license-current-info').classList.add('hidden');
    showScreen('license');
    return;
  }

  switch (status.state) {
    case 'idle':
      showScreen('main');
      break;
    case 'ready':
      parsedEmployees = status.employees ?? [];
      showPreview();
      break;
    case 'running':
    case 'paused':
      showScreen('progress');
      updateProgress(status);
      break;
    case 'completed':
    case 'error':
      showScreen('results');
      updateResults(status);
      break;
  }
}

// === Парсинг Excel ===

function handleFile(file: File): void {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const buffer = e.target?.result as ArrayBuffer;
      parsedEmployees = parseExcelFile(buffer);
      showPreview();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Ошибка чтения файла: ${msg}`);
    }
  };
  reader.readAsArrayBuffer(file);
}

// === Предпросмотр ===

function showPreview(): void {
  showScreen('preview');

  $('preview-count').textContent = String(parsedEmployees.length);

  // Валидация
  const errors = validateEmployees(parsedEmployees);
  const errorsEl = $('validation-errors');
  if (errors.length) {
    errorsEl.textContent = errors.join('; ');
    errorsEl.classList.remove('hidden');
  } else {
    errorsEl.classList.add('hidden');
  }

  // Таблица предпросмотра (первые 10 строк)
  const tbody = $('preview-table').querySelector('tbody')!;
  tbody.innerHTML = '';
  const showCount = Math.min(parsedEmployees.length, 10);

  for (let i = 0; i < showCount; i++) {
    const emp = parsedEmployees[i];
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td title="${esc(emp.name)}">${esc(truncate(emp.name, 18))}</td>
      <td>${esc(emp.series ? `${emp.series} ` : '')}${esc(emp.number)}</td>
      <td>${esc(emp.issueDate)}</td>
      <td>${esc(emp.birthDate)}</td>
    `;
    tbody.appendChild(tr);
  }

  const moreEl = $('preview-more');
  if (parsedEmployees.length > showCount) {
    moreEl.textContent = `и ещё ${parsedEmployees.length - showCount}...`;
    moreEl.classList.remove('hidden');
  } else {
    moreEl.classList.add('hidden');
  }
}

// === Управление проверкой ===

async function startCheck(): Promise<void> {
  const tab = await findGosuslugiTab();
  if (!tab) {
    alert('Откройте страницу проверки РКЛ на Госуслугах (gosuslugi.ru/655781/1/form)');
    return;
  }

  const loadResult = await sendMessage<BaseResponse>({
    type: 'LOAD_EMPLOYEES',
    employees: parsedEmployees,
  });
  if (!loadResult?.ok) {
    alert(`Ошибка загрузки данных: ${loadResult?.error ?? 'неизвестная ошибка'}`);
    return;
  }

  const startResult = await sendMessage<BaseResponse>({
    type: 'START_CHECK',
    tabId: tab.id!,
  });
  if (!startResult?.ok) {
    if (startResult?.error === 'license_inactive') {
      alert('Лицензия неактивна или истекла. Активируйте новый ключ.');
      showScreen('license');
      return;
    }
    if (startResult?.error === 'limit_exceeded') {
      alert('Исчерпан лимит проверок на этот месяц. Обновите тариф.');
      return;
    }
    alert(`Ошибка запуска: ${startResult?.error ?? 'неизвестная ошибка'}`);
    return;
  }

  showScreen('progress');
}

async function stopCheck(): Promise<void> {
  if (!confirm('Остановить проверку? Результаты будут сохранены.')) return;
  await sendMessage({ type: 'STOP_CHECK' });
}

async function retryErrors(): Promise<void> {
  const tab = await findGosuslugiTab();
  if (!tab) {
    alert('Откройте страницу проверки РКЛ на Госуслугах');
    return;
  }
  await sendMessage({ type: 'RETRY_ERRORS', tabId: tab.id! });
  showScreen('progress');
}

async function newCheck(): Promise<void> {
  await sendMessage({ type: 'CLEAR_SESSION' });
  parsedEmployees = [];
  showScreen('main');
}

// === Обновление UI по статусу ===

function handleStatusUpdate(status: StatusUpdateMessage): void {
  if (status.license) updateLicenseUI(status.license);

  switch (status.state) {
    case 'running':
    case 'paused':
      showScreen('progress');
      updateProgress(status);
      break;
    case 'completed':
    case 'error':
      showScreen('results');
      updateResults(status);
      break;
  }
}

interface StatusLike {
  state: QueueState;
  currentIndex: number;
  total: number;
  results: CheckResult[];
  employees: Employee[];
  startedAt: string | null;
}

function updateProgress(status: StatusLike): void {
  const { currentIndex, total, results, state, employees } = status;
  const checked = results.filter((r) => r.status !== 'pending').length;

  const pct = total > 0 ? (checked / total) * 100 : 0;
  $('progress-fill').style.width = `${pct}%`;
  $('progress-current').textContent = String(checked);
  $('progress-total').textContent = String(total);

  const currentEmp = employees?.[currentIndex];
  if (currentEmp) {
    $('progress-current-employee').textContent =
      state === 'running' ? `Проверяется: ${currentEmp.number}...` : 'На паузе';
  }

  const stats = countResults(results);
  $('stat-ok').textContent = String(stats.notFound);
  $('stat-found').textContent = String(stats.found);
  $('stat-error').textContent = String(stats.error);

  // ETA
  if (checked > 0 && state === 'running' && status.startedAt) {
    const elapsed = Date.now() - new Date(status.startedAt).getTime();
    const remaining = ((total - checked) * elapsed) / checked;
    $('progress-eta').textContent = `~${formatDuration(remaining)}`;
  } else {
    $('progress-eta').textContent = '';
  }

  $('btn-pause').classList.toggle('hidden', state !== 'running');
  $('btn-resume').classList.toggle('hidden', state !== 'paused');
}

function updateResults(status: StatusLike): void {
  const { results, employees } = status;
  parsedEmployees = employees;

  const stats = countResults(results);
  $('result-total').textContent = String(results.length);
  $('result-ok').textContent = String(stats.notFound);
  $('result-found').textContent = String(stats.found);
  $('result-errors').textContent = String(stats.error);
  $('btn-retry-errors').classList.toggle('hidden', stats.error === 0);

  renderResultsTable();
}

function renderResultsTable(): void {
  if (!lastStatus) return;
  const { results, employees } = lastStatus;
  const tbody = $('results-table').querySelector('tbody')!;
  tbody.innerHTML = '';

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const emp = employees[i];

    if (currentFilter === 'found' && r.status !== 'found') continue;
    if (currentFilter === 'error' && r.status !== 'error') continue;

    const rowClass =
      r.status === 'not_found' ? 'row-ok' :
      r.status === 'found' ? 'row-found' :
      r.status === 'error' ? 'row-error' : '';

    const statusText =
      r.status === 'not_found' ? 'Не найден' :
      r.status === 'found' ? 'НАЙДЕН В РКЛ' :
      r.status === 'error' ? 'Ошибка' : '—';

    const statusClass =
      r.status === 'not_found' ? 'status-ok' :
      r.status === 'found' ? 'status-found' :
      r.status === 'error' ? 'status-error' : 'status-pending';

    const doc = `${emp?.series ? `${emp.series} ` : ''}${emp?.number ?? ''}`;

    const tr = document.createElement('tr');
    tr.className = rowClass;
    tr.innerHTML = `
      <td title="${esc(emp?.name ?? '')}">${esc(truncate(emp?.name ?? '—', 14))}</td>
      <td>${esc(doc)}</td>
      <td class="${statusClass}">${statusText}</td>
      <td>${esc(formatTimestamp(r.timestamp))}</td>
    `;
    tbody.appendChild(tr);
  }
}

// === Экспорт ===

function exportResults(): void {
  if (!lastStatus) return;
  exportResultsToExcel(lastStatus.employees, lastStatus.results);
}

// === Настройки ===

async function openSettings(): Promise<void> {
  // Remember current screen to return to
  for (const [name, el] of Object.entries(screens)) {
    if (!el.classList.contains('hidden')) {
      settingsReturnScreen = name as keyof typeof screens;
      break;
    }
  }

  const resp = await sendMessage<SettingsResponse>({ type: 'GET_SETTINGS' });
  if (resp?.ok) {
    const s = resp.settings;
    ($('setting-auto-download') as HTMLInputElement).checked = s.autoDownload;
    ($('setting-notify') as HTMLInputElement).checked = s.notifyOnComplete;
    ($('setting-download-folder') as HTMLInputElement).value = s.downloadSubfolder;
    ($('setting-delay') as HTMLInputElement).value = String(s.delayBetweenChecks);
    $('delay-value-hint').textContent = `${(s.delayBetweenChecks / 1000).toFixed(1)} сек`;
    $('setting-folder-row').classList.toggle('hidden', !s.autoDownload);
  }

  showScreen('settings');
}

async function saveSettings(): Promise<void> {
  const updated: Partial<Settings> = {
    autoDownload: ($('setting-auto-download') as HTMLInputElement).checked,
    notifyOnComplete: ($('setting-notify') as HTMLInputElement).checked,
    downloadSubfolder: ($('setting-download-folder') as HTMLInputElement).value.trim() || 'RKL_Check',
    delayBetweenChecks: Number(($('setting-delay') as HTMLInputElement).value),
  };

  await sendMessage({ type: 'SAVE_SETTINGS', settings: updated as Settings });
  showScreen(settingsReturnScreen);
}

// === Лицензия ===

async function handleActivateLicense(): Promise<void> {
  const input = $('license-key-input') as HTMLInputElement;
  const key = input.value.trim();
  const errorEl = $('license-error');
  const btn = $('btn-activate') as HTMLButtonElement;

  if (!key) {
    showLicenseError('Введите лицензионный ключ');
    return;
  }

  // Disable button during request
  btn.disabled = true;
  btn.textContent = 'Активация...';
  errorEl.classList.add('hidden');

  try {
    const resp = await sendMessage<LicenseResponse>({ type: 'ACTIVATE_LICENSE', key });

    if (resp?.ok && resp.license) {
      updateLicenseUI(resp.license);
      showScreen('main');
    } else {
      const errMsg = resp?.error ?? 'unknown';
      showLicenseError(mapLicenseError(errMsg));
    }
  } catch {
    showLicenseError('Не удалось связаться с сервером лицензий');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Активировать';
  }
}

function showLicenseError(msg: string): void {
  const el = $('license-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function mapLicenseError(error: string): string {
  // Error format from service worker: "code:message"
  const code = error.split(':')[0];
  const map: Record<string, string> = {
    invalid_key: 'Ключ не найден. Проверьте правильность ввода.',
    license_inactive: 'Лицензия деактивирована.',
    license_expired: 'Срок действия лицензии истёк.',
    device_mismatch: 'Ключ привязан к другому устройству.',
    hmac_invalid: 'Ошибка проверки подписи сервера.',
    missing_params: 'Ошибка: не все параметры переданы.',
  };
  return map[code] ?? 'Ошибка активации. Попробуйте позже.';
}

function openChangeLicense(): void {
  // Show current license info and back button
  const info = $('license-current-info');
  const backBtn = $('btn-license-back');

  if (lastStatus?.license) {
    const lic = lastStatus.license;
    const planLabel = PLAN_LABELS[lic.plan as LicensePlan] ?? lic.plan;
    const exp = new Date(lic.expires).toLocaleDateString('ru-RU');
    info.textContent = `Текущий тариф: ${planLabel} (${lic.used}/${lic.limit}), до ${exp}`;
    info.classList.remove('hidden');
  }

  backBtn.classList.remove('hidden');
  ($('license-key-input') as HTMLInputElement).value = '';
  $('license-error').classList.add('hidden');
  showScreen('license');
}

function updateLicenseUI(license: LicenseInfo): void {
  // Plan badge in header
  const badge = document.getElementById('plan-badge');
  if (badge) {
    badge.textContent = PLAN_LABELS[license.plan as LicensePlan] ?? license.plan;
  }

  // License bar
  const barPlan = document.getElementById('license-bar-plan');
  const barUsage = document.getElementById('license-bar-usage');
  const barExpires = document.getElementById('license-bar-expires');

  if (barPlan) barPlan.textContent = PLAN_LABELS[license.plan as LicensePlan] ?? license.plan;
  if (barUsage) barUsage.textContent = `${license.used} / ${license.limit}`;
  if (barExpires) {
    const exp = new Date(license.expires);
    barExpires.textContent = `до ${exp.toLocaleDateString('ru-RU')}`;
  }
}

// === Навигация ===

function openGosuslugi(): void {
  chrome.tabs.create({ url: 'https://www.gosuslugi.ru/655781/1/form' });
}

function findGosuslugiTab(): Promise<chrome.tabs.Tab | null> {
  return new Promise((resolve) => {
    chrome.tabs.query({ url: 'https://www.gosuslugi.ru/655781/*' }, (tabs) => {
      resolve(tabs?.length ? tabs[0] : null);
    });
  });
}

// === Утилиты ===

function countResults(results: CheckResult[]): ResultStats {
  const stats: ResultStats = { total: results.length, notFound: 0, found: 0, error: 0, pending: 0 };
  for (const r of results) {
    if (r.status === 'not_found') stats.notFound++;
    else if (r.status === 'found') stats.found++;
    else if (r.status === 'error') stats.error++;
    else stats.pending++;
  }
  return stats;
}

function formatDuration(ms: number): string {
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec} сек`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return rem > 0 ? `${min} мин ${rem} сек` : `${min} мин`;
}

function formatTimestamp(ts: string | null): string {
  if (!ts) return '';
  if (ts.includes('МСК')) {
    const match = ts.match(/(\d{2}:\d{2})/);
    return match ? match[1] : ts;
  }
  try {
    return new Date(ts).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Moscow',
    });
  } catch {
    return ts;
  }
}

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? `${str.slice(0, maxLen - 1)}…` : str;
}

function esc(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
