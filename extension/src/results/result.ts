// Results page — full-screen view with filters, sorting, and search

import type { Complaint, FillResult, FillStatus, QueueData } from '@/types';

// === Types ===

type FilterType = 'all' | 'submitted' | 'filled' | 'error';
type SortColumn = 'index' | 'orgName' | 'territorialBody' | 'status';
type SortDir = 'asc' | 'desc';

interface ResultEntry {
  index: number;
  complaint: Complaint;
  result: FillResult;
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

  if (!queue || !queue.complaints.length) {
    showEmptyState();
    return;
  }

  entries = queue.complaints.map((complaint, i) => ({
    index: i,
    complaint,
    result: queue.results[i] ?? { status: 'pending' as FillStatus },
  }));
}

// === Event binding ===

function bindEvents(): void {
  const searchInput = document.getElementById('search-input') as HTMLInputElement;
  let searchTimeout: ReturnType<typeof setTimeout>;
  searchInput?.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentSearch = searchInput.value.trim().toLowerCase();
      renderTable();
    }, 300);
  });

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
  setText('stat-submitted', stats.submitted);
  setText('stat-filled', stats.filled);
  setText('stat-error', stats.error);
}

function renderFilterCounts(): void {
  const stats = computeStats();
  setText('count-all', stats.total);
  setText('count-submitted', stats.submitted);
  setText('count-filled', stats.filled);
  setText('count-error', stats.error);
}

function renderTable(): void {
  const tbody = document.getElementById('table-body');
  if (!tbody) return;

  const filtered = getFilteredEntries();

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:#94A3B8;">
      ${entries.length ? 'Нет результатов по выбранному фильтру' : 'Нет данных'}
    </td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(entry => {
    const { complaint: c, result: r } = entry;
    const rowClass = getRowClass(r);
    const badge = getStatusBadge(r);

    return `<tr class="${rowClass}">
      <td class="col-num-cell">${entry.index + 1}</td>
      <td title="${esc(c.orgName)}">${esc(truncate(c.orgName, 30))}</td>
      <td title="${esc(c.territorialBody)}">${esc(truncate(c.territorialBody, 25))}</td>
      <td title="${esc(c.appealText)}">${esc(truncate(c.appealText, 40))}</td>
      <td>${badge}</td>
    </tr>`;
  }).join('');
}

// === Filtering & sorting ===

function getFilteredEntries(): ResultEntry[] {
  let result = [...entries];

  if (currentFilter !== 'all') {
    result = result.filter(e => getFilterCategory(e.result) === currentFilter);
  }

  if (currentSearch) {
    result = result.filter(e => {
      const org = (e.complaint.orgName || '').toLowerCase();
      const text = (e.complaint.appealText || '').toLowerCase();
      const territory = (e.complaint.territorialBody || '').toLowerCase();
      return org.includes(currentSearch) || text.includes(currentSearch) || territory.includes(currentSearch);
    });
  }

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

function getFilterCategory(r: FillResult): FilterType {
  if (r.status === 'submitted') return 'submitted';
  if (r.status === 'filled') return 'filled';
  if (r.status === 'error') return 'error';
  return 'error';
}

function getSortValue(entry: ResultEntry, col: SortColumn): string | number {
  switch (col) {
    case 'index': return entry.index;
    case 'orgName': return (entry.complaint.orgName || '').toLowerCase();
    case 'territorialBody': return (entry.complaint.territorialBody || '').toLowerCase();
    case 'status': return statusOrder(entry.result);
    default: return '';
  }
}

function statusOrder(r: FillResult): number {
  if (r.status === 'submitted') return 0;
  if (r.status === 'filled') return 1;
  if (r.status === 'error') return 2;
  return 3;
}

// === Stats ===

function computeStats() {
  let total = 0, submitted = 0, filled = 0, error = 0;
  for (const e of entries) {
    total++;
    const cat = getFilterCategory(e.result);
    if (cat === 'submitted') submitted++;
    else if (cat === 'filled') filled++;
    else error++;
  }
  return { total, submitted, filled, error };
}

// === Status badges ===

function getStatusBadge(r: FillResult): string {
  switch (r.status) {
    case 'submitted':
      return `<span class="badge-status badge-ok">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>
        Отправлено
      </span>`;
    case 'filled':
      return `<span class="badge-status badge-warning">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        Заполнено
      </span>`;
    case 'error':
      return `<span class="badge-status badge-error">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
        Ошибка
      </span>`;
    default:
      return `<span class="badge-status badge-pending">Ожидание</span>`;
  }
}

function getRowClass(r: FillResult): string {
  if (r.status === 'submitted') return 'row-ok';
  if (r.status === 'filled') return 'row-warning';
  if (r.status === 'error') return 'row-error';
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

async function handleClear(): Promise<void> {
  if (!confirm('Очистить все результаты?')) return;

  const data = await chrome.storage.local.get('queue');
  const queue = data.queue as QueueData | undefined;
  if (queue) {
    queue.complaints = [];
    queue.results = [];
    queue.currentIndex = 0;
    queue.state = 'idle';
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

function truncate(str: string, maxLen: number): string {
  if (!str) return '—';
  return str.length > maxLen ? `${str.slice(0, maxLen - 1)}…` : str;
}
