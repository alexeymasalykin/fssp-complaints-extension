// Excel parsing for FSSP complaint data

import * as XLSX from 'xlsx';
import type { Complaint } from '@/types';

// === Column aliases ===

const COLUMN_ALIASES: Record<string, string[]> = {
  orgName: ['организация', 'наименование организации', 'наименование', 'org', 'company'],
  region: ['субъект рф', 'субъект', 'регион', 'region'],
  municipality: ['муниципальное образование', 'муниципалитет', 'municipality'],
  locality: ['населенный пункт', 'населённый пункт', 'нас. пункт', 'locality'],
  street: ['улица', 'street'],
  house: ['дом', 'номер дома', 'house'],
  building: ['корпус', 'номер корпуса', 'building'],
  apartment: ['квартира', 'номер квартиры', 'кв', 'apartment'],
  postalCode: ['индекс', 'почтовый индекс', 'postal'],
  appealType: ['вид обращения', 'вид', 'appeal type'],
  appealTopic: ['тема обращения', 'тема', 'appeal topic'],
  territorialBody: ['территориальный орган', 'территориальный', 'орган', 'territorial'],
  structuralUnit: ['структурное подразделение', 'подразделение', 'структурное подразделение фссп', 'структурное подразделение фссп россии', 'structural unit'],
  fsspEmployee: ['сотрудник фссп', 'сотрудник', 'employee'],
  appealText: ['текст обращения', 'текст', 'обращение', 'appeal text', 'text'],
};

// === Parse Excel file ===

export function parseExcelFile(buffer: ArrayBuffer): Complaint[] {
  const data = new Uint8Array(buffer);
  const workbook = XLSX.read(data, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  if (!rows.length) {
    throw new Error('Файл пуст или не содержит данных');
  }

  const complaints = mapColumns(rows);
  if (!complaints.length) {
    throw new Error('Не удалось распознать колонки. Проверьте заголовки.');
  }

  return complaints;
}

// === Map headers to Complaint fields ===

function mapColumns(rows: Record<string, unknown>[]): Complaint[] {
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

  // Must have at least appealText or territorialBody
  if (!mapping.appealText && !mapping.territorialBody) {
    return [];
  }

  return rows
    .filter((row) => {
      // Skip empty rows (no org name AND no appeal text)
      const org = str(row[mapping.orgName!]);
      const text = str(row[mapping.appealText!]);
      return org !== '' || text !== '';
    })
    .map((row, idx) => ({
    index: idx,
    orgName: str(row[mapping.orgName!]),
    region: str(row[mapping.region!]),
    municipality: str(row[mapping.municipality!]),
    locality: str(row[mapping.locality!]),
    street: str(row[mapping.street!]),
    house: str(row[mapping.house!]),
    building: str(row[mapping.building!]),
    apartment: str(row[mapping.apartment!]),
    postalCode: str(row[mapping.postalCode!]),
    appealType: str(row[mapping.appealType!]),
    appealTopic: str(row[mapping.appealTopic!]),
    territorialBody: str(row[mapping.territorialBody!]),
    structuralUnit: str(row[mapping.structuralUnit!]),
    fsspEmployee: str(row[mapping.fsspEmployee!]),
    appealText: str(row[mapping.appealText!]),
  }));
}

function str(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

// === Validation ===

export function validateComplaints(complaints: Complaint[]): string[] {
  const errors: string[] = [];
  const noText: number[] = [];
  const noOrg: number[] = [];

  for (let i = 0; i < complaints.length; i++) {
    const c = complaints[i];
    const row = i + 1;
    if (!c.appealText) noText.push(row);
    if (!c.orgName) noOrg.push(row);
  }

  const fmt = (rows: number[]) => rows.length <= 5
    ? rows.join(', ')
    : `${rows.slice(0, 5).join(', ')} и ещё ${rows.length - 5}`;

  if (noText.length) errors.push(`Нет текста обращения: строки ${fmt(noText)}`);
  if (noOrg.length) errors.push(`Нет организации: строки ${fmt(noOrg)}`);

  return errors;
}
