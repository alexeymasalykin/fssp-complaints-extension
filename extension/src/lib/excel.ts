// Модуль парсинга и генерации Excel-файлов через SheetJS

import * as XLSX from 'xlsx';
import type { Employee, CheckResult } from '@/types';

// === Алиасы заголовков колонок ===

const COLUMN_ALIASES: Record<string, string[]> = {
  number: ['номер', 'номер документа', 'passport no', 'docnum', 'passportno', 'doc_number'],
  issueDate: ['дата выдачи', 'issue date', 'docdate', 'doc_date', 'issuedate'],
  birthDate: ['дата рождения', 'birthdate', 'др', 'birth_date', 'birthday'],
  series: ['серия', 'series', 'doc_series'],
  name: ['фио', 'имя', 'name', 'fio', 'fullname', 'full_name'],
};

// === Парсинг Excel-файла ===

export function parseExcelFile(buffer: ArrayBuffer): Employee[] {
  const data = new Uint8Array(buffer);
  const workbook = XLSX.read(data, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  if (!rows.length) {
    throw new Error('Файл пуст или не содержит данных');
  }

  const employees = mapColumns(rows);
  if (!employees.length) {
    throw new Error('Не удалось распознать колонки. Проверьте заголовки: Номер, Дата выдачи, Дата рождения');
  }

  return employees;
}

// === Маппинг заголовков к полям Employee ===

function mapColumns(rows: Record<string, unknown>[]): Employee[] {
  const headers = Object.keys(rows[0]);
  const mapping: Partial<Record<string, string>> = {};

  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const header of headers) {
      if (aliases.includes(header.trim().toLowerCase())) {
        mapping[field] = header;
        break;
      }
    }
  }

  // Обязательные поля
  if (!mapping.number || !mapping.issueDate || !mapping.birthDate) {
    return [];
  }

  return rows.map((row, idx) => ({
    index: idx,
    number: normalizeValue(row[mapping.number!]),
    issueDate: normalizeDate(row[mapping.issueDate!]),
    birthDate: normalizeDate(row[mapping.birthDate!]),
    series: mapping.series ? normalizeValue(row[mapping.series]) : '',
    name: mapping.name ? String(row[mapping.name] ?? '').trim() : '',
  }));
}

function normalizeValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function normalizeDate(val: unknown): string {
  if (!val) return '';

  // Excel serial date
  if (typeof val === 'number') {
    return formatDate(excelDateToJS(val));
  }

  const str = String(val).trim();

  // ГГГГ-ММ-ДД → ДД.ММ.ГГГГ
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[3]}.${isoMatch[2]}.${isoMatch[1]}`;
  }

  // Уже ДД.ММ.ГГГГ
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(str)) {
    return str;
  }

  return str;
}

function excelDateToJS(serial: number): Date {
  const utcDays = Math.floor(serial - 25569);
  return new Date(utcDays * 86400 * 1000);
}

function formatDate(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}.${month}.${year}`;
}

// === Валидация загруженных данных ===

export function validateEmployees(employees: Employee[]): string[] {
  const errors: string[] = [];
  const emptyNumbers: number[] = [];
  const emptyIssueDates: number[] = [];
  const emptyBirthDates: number[] = [];
  const badDates: number[] = [];

  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i];
    const row = i + 1; // 1-based row number for user display
    if (!emp.number) emptyNumbers.push(row);
    if (!emp.issueDate) emptyIssueDates.push(row);
    if (!emp.birthDate) emptyBirthDates.push(row);
    if (emp.issueDate && !/^\d{2}\.\d{2}\.\d{4}$/.test(emp.issueDate)) badDates.push(row);
    if (emp.birthDate && !/^\d{2}\.\d{2}\.\d{4}$/.test(emp.birthDate)) badDates.push(row);
  }

  const fmt = (rows: number[]) => rows.length <= 5
    ? rows.join(', ')
    : `${rows.slice(0, 5).join(', ')} и ещё ${rows.length - 5}`;

  if (emptyNumbers.length) errors.push(`Нет номера документа: строки ${fmt(emptyNumbers)}`);
  if (emptyIssueDates.length) errors.push(`Нет даты выдачи: строки ${fmt(emptyIssueDates)}`);
  if (emptyBirthDates.length) errors.push(`Нет даты рождения: строки ${fmt(emptyBirthDates)}`);
  if (badDates.length) errors.push(`Некорректная дата (нужен ДД.ММ.ГГГГ): строки ${fmt(badDates)}`);

  return errors;
}

// === Построение workbook с результатами ===

function buildResultWorkbook(
  employees: Employee[],
  results: CheckResult[]
): { workbook: XLSX.WorkBook; filename: string } {
  const rows = results.map((r, i) => {
    const emp = employees[i] ?? {} as Partial<Employee>;
    const statusText =
      r.status === 'not_found' ? 'Не найден' :
      r.status === 'found' ? 'Найден в РКЛ' :
      r.status === 'error' ? 'Ошибка' : 'Не проверен';

    return {
      '№': i + 1,
      'ФИО': emp.name ?? '',
      'Серия': emp.series ?? '',
      'Номер': emp.number ?? '',
      'Дата выдачи': emp.issueDate ?? '',
      'Дата рождения': emp.birthDate ?? '',
      'Статус РКЛ': statusText,
      'Дата проверки': r.timestamp ?? '',
      'Источник': r.source ?? 'Госуслуги / МВД России',
      'Примечание': r.error ?? '',
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);

  ws['!cols'] = [
    { wch: 4 },  // №
    { wch: 25 }, // ФИО
    { wch: 8 },  // Серия
    { wch: 15 }, // Номер
    { wch: 12 }, // Дата выдачи
    { wch: 14 }, // Дата рождения
    { wch: 16 }, // Статус
    { wch: 20 }, // Дата проверки
    { wch: 25 }, // Источник
    { wch: 30 }, // Примечание
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, ws, 'Результаты РКЛ');

  const now = new Date();
  const dateStr = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');

  return { workbook, filename: `RKL_Check_${dateStr}.xlsx` };
}

// === Экспорт результатов — скачивание через браузер (popup) ===

export function exportResultsToExcel(
  employees: Employee[],
  results: CheckResult[]
): void {
  const { workbook, filename } = buildResultWorkbook(employees, results);
  XLSX.writeFile(workbook, filename);
}

// === Экспорт результатов — ArrayBuffer (для service worker / chrome.downloads) ===

export function exportResultsToArrayBuffer(
  employees: Employee[],
  results: CheckResult[]
): { buffer: ArrayBuffer; filename: string } {
  const { workbook, filename } = buildResultWorkbook(employees, results);
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return { buffer, filename };
}
