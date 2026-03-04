// Results page — full-screen view with filters, sorting, search, and export

import type { Employee, CheckResult, QueueData } from '@/types';
import { exportResultsToExcel } from '@/lib/excel';

// === Types ===

type FilterType = 'all' | 'not_found' | 'found' | 'no_data' | 'error';
type SortColumn = 'index' | 'name' | 'series' | 'number' | 'issueDate' | 'birthDate' | 'status' | 'timestamp';
type SortDir = 'asc' | 'desc';

interface ResultEntry {
  index: number;
  employee: Employee;
  result: CheckResult;
}

// === State ===

let entries: ResultEntry[] = [];
let currentFilter: FilterType = 'all';
let currentSearch = '';
let sortColumn: SortColumn | null = null;
let sortDir: SortDir = 'asc';

// === Init ===

document.addEventListener('DOMContentLoaded', init);

async function init(): Promise<void> {
  await loadData();
  bindEvents();
  render();
}

// === Data loading ===

async function loadData(): Promise<void> {
  const data = await chrome.storage.local.get('queue');
  const queue = data.queue as QueueData | undefined;

  if (!queue || !queue.employees.length) {
    showEmptyState();
    return;
  }

  entries = queue.employees.map((emp, i) => ({
    index: i,
    employee: emp,
    result: queue.results[i] ?? { status: 'pending' as const, found: null, timestamp: null, source: null, error: null },
  }));

  // Set check date
  const dateEl = document.getElementById('check-date');
  if (dateEl && queue.startedAt) {
    const d = new Date(queue.startedAt);
    dateEl.textContent = `Проверка от ${formatFullDate(d)}`;
  }
}

// === Event binding ===

function bindEvents(): void {
  // Search
  const searchInput = document.getElementById('search-input') as HTMLInputElement;
  let searchTimeout: ReturnType<typeof setTimeout>;
  searchInput?.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentSearch = searchInput.value.trim().toLowerCase();
      renderTable();
    }, 300);
  });

  // Filter tabs
  document.getElementById('filter-tabs')?.addEventListener('click', (e) => {
    const tab = (e.target as HTMLElement).closest('.filter-tab') as HTMLElement | null;
    if (!tab) return;
    const filter = tab.dataset.filter as FilterType;
    if (!filter) return;

    currentFilter = filter;
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    renderTable();
  });

  // Sort headers
  document.querySelectorAll('.data-table th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const col = (th as HTMLElement).dataset.sort as SortColumn;
      if (sortColumn === col) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortColumn = col;
        sortDir = 'asc';
      }
      updateSortIndicators();
      renderTable();
    });
  });

  // Export
  document.getElementById('btn-export')?.addEventListener('click', handleExport);

  // Clear
  document.getElementById('btn-clear')?.addEventListener('click', handleClear);
}

// === Rendering ===

function render(): void {
  renderSummary();
  renderFilterCounts();
  renderTable();
}

function renderSummary(): void {
  const stats = computeStats();
  setText('stat-total', stats.total);
  setText('stat-ok', stats.notFound);
  setText('stat-found', stats.found);
  setText('stat-error', stats.error + stats.noData);
}

function renderFilterCounts(): void {
  const stats = computeStats();
  setText('count-all', stats.total);
  setText('count-ok', stats.notFound);
  setText('count-found', stats.found);
  setText('count-nodata', stats.noData);
  setText('count-error', stats.error);
}

function renderTable(): void {
  const tbody = document.getElementById('table-body');
  if (!tbody) return;

  const filtered = getFilteredEntries();

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;color:#94A3B8;">
      ${entries.length ? 'Нет результатов по выбранному фильтру' : 'Нет данных'}
    </td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(entry => {
    const { employee: emp, result: r } = entry;
    const rowClass = getRowClass(r);
    const badge = getStatusBadge(r);
    const comment = getComment(emp, r);

    return `<tr class="${rowClass}">
      <td class="col-num-cell">${entry.index + 1}</td>
      <td>${esc(emp.name || '—')}</td>
      <td>${esc(emp.series || '—')}</td>
      <td>${esc(emp.number)}</td>
      <td>${esc(emp.issueDate)}</td>
      <td>${esc(emp.birthDate)}</td>
      <td>${badge}</td>
      <td>${r.timestamp ? formatTime(r.timestamp) : '—'}</td>
      <td>${esc(comment)}</td>
    </tr>`;
  }).join('');
}

// === Filtering & sorting ===

function getFilteredEntries(): ResultEntry[] {
  let result = [...entries];

  // Filter by status
  if (currentFilter !== 'all') {
    result = result.filter(e => getFilterCategory(e.result) === currentFilter);
  }

  // Search
  if (currentSearch) {
    result = result.filter(e => {
      const name = (e.employee.name || '').toLowerCase();
      const num = (e.employee.number || '').toLowerCase();
      const series = (e.employee.series || '').toLowerCase();
      return name.includes(currentSearch) || num.includes(currentSearch) || series.includes(currentSearch);
    });
  }

  // Sort
  if (sortColumn) {
    result.sort((a, b) => {
      const valA = getSortValue(a, sortColumn!);
      const valB = getSortValue(b, sortColumn!);
      const cmp = valA < valB ? -1 : valA > valB ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }

  return result;
}

function getFilterCategory(r: CheckResult): FilterType {
  if (r.status === 'not_found') return 'not_found';
  if (r.status === 'found') return 'found';
  if (r.status === 'error') {
    // "Insufficient data" — missing required fields
    if (r.error && /недостаточно|пуст|missing/i.test(r.error)) return 'no_data';
    return 'error';
  }
  return 'error';
}

function getSortValue(entry: ResultEntry, col: SortColumn): string | number {
  switch (col) {
    case 'index': return entry.index;
    case 'name': return (entry.employee.name || '').toLowerCase();
    case 'series': return (entry.employee.series || '').toLowerCase();
    case 'number': return (entry.employee.number || '').toLowerCase();
    case 'issueDate': return dateToSortable(entry.employee.issueDate);
    case 'birthDate': return dateToSortable(entry.employee.birthDate);
    case 'status': return statusOrder(entry.result);
    case 'timestamp': return entry.result.timestamp || '';
    default: return '';
  }
}

function statusOrder(r: CheckResult): number {
  if (r.status === 'found') return 0;
  if (r.status === 'error') return 1;
  if (r.status === 'not_found') return 2;
  return 3;
}

function dateToSortable(dateStr: string): string {
  // ДД.ММ.ГГГГ → ГГГГ-ММ-ДД for sorting
  const m = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : dateStr;
}

// === Stats ===

function computeStats() {
  let total = 0, notFound = 0, found = 0, error = 0, noData = 0;
  for (const e of entries) {
    total++;
    const cat = getFilterCategory(e.result);
    if (cat === 'not_found') notFound++;
    else if (cat === 'found') found++;
    else if (cat === 'no_data') noData++;
    else error++;
  }
  return { total, notFound, found, error, noData };
}

// === Status badges ===

function getStatusBadge(r: CheckResult): string {
  switch (r.status) {
    case 'not_found':
      return `<span class="badge-status badge-ok">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>
        Отсутствует в реестре
      </span>`;
    case 'found':
      return `<span class="badge-status badge-found">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
        Есть в реестре
      </span>`;
    case 'error':
      if (r.error && /недостаточно|пуст|missing/i.test(r.error)) {
        return `<span class="badge-status badge-warning">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
          Недостаточно данных
        </span>`;
      }
      return `<span class="badge-status badge-error">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
        Ошибка
      </span>`;
    default:
      return `<span class="badge-status badge-pending">Ожидание</span>`;
  }
}

function getRowClass(r: CheckResult): string {
  if (r.status === 'not_found') return 'row-ok';
  if (r.status === 'found') return 'row-found';
  if (r.status === 'error') {
    if (r.error && /недостаточно|пуст|missing/i.test(r.error)) return 'row-warning';
    return 'row-error';
  }
  return '';
}

function getComment(emp: Employee, r: CheckResult): string {
  if (r.status === 'not_found') return 'Отсутствует в реестре контролируемых лиц';
  if (r.status === 'found') return 'Есть в реестре контролируемых лиц';
  if (r.status === 'error' && r.error) return r.error;
  if (!emp.number || !emp.birthDate || !emp.issueDate) return 'Недостаточно данных для проверки';
  return '';
}

// === Sort indicators ===

function updateSortIndicators(): void {
  document.querySelectorAll('.data-table th[data-sort]').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if ((th as HTMLElement).dataset.sort === sortColumn) {
      th.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });
}

// === Actions ===

function handleExport(): void {
  if (!entries.length) return;
  const employees = entries.map(e => e.employee);
  const results = entries.map(e => e.result);
  exportResultsToExcel(employees, results);
}

async function handleClear(): Promise<void> {
  if (!confirm('Очистить все результаты проверки?')) return;

  const data = await chrome.storage.local.get('queue');
  const queue = data.queue as QueueData | undefined;
  if (queue) {
    queue.employees = [];
    queue.results = [];
    queue.currentIndex = 0;
    queue.state = 'idle';
    queue.startedAt = null;
    queue.pausedAt = null;
    await chrome.storage.local.set({ queue });
  }

  entries = [];
  render();
  showEmptyState();
}

// === UI helpers ===

function showEmptyState(): void {
  document.getElementById('summary')?.classList.add('hidden');
  document.querySelector('.toolbar')?.classList.add('hidden');
  document.querySelector('.table-section')?.classList.add('hidden');
  document.getElementById('empty-state')?.classList.remove('hidden');
}

function setText(id: string, value: string | number): void {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value);
}

function esc(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatTime(timestamp: string): string {
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) {
      // Try parsing "DD.MM.YYYY HH:MM МСК" format
      const m = timestamp.match(/(\d{2}:\d{2})/);
      return m ? m[1] : timestamp;
    }
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' });
  } catch {
    return timestamp;
  }
}

function formatFullDate(d: Date): string {
  return d.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Moscow',
  });
}
