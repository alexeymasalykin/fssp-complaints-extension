import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseExcelFile, validateComplaints } from './excel';
import type { Complaint } from '@/types';

// Helper: create ArrayBuffer from row data
function makeExcel(rows: Record<string, string>[]): ArrayBuffer {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return out;
}

describe('parseExcelFile', () => {
  it('parses basic complaint with Russian headers', () => {
    const buf = makeExcel([{
      'Наименование организации': 'ООО Ромашка',
      'Субъект РФ': 'Москва',
      'Текст обращения': 'Жалоба на бездействие',
    }]);

    const result = parseExcelFile(buf);
    expect(result).toHaveLength(1);
    expect(result[0].orgName).toBe('ООО Ромашка');
    expect(result[0].region).toBe('Москва');
    expect(result[0].appealText).toBe('Жалоба на бездействие');
    expect(result[0].index).toBe(0);
  });

  it('maps all known fields', () => {
    const buf = makeExcel([{
      'Наименование организации': 'ООО Тест',
      'Субъект РФ': 'Москва',
      'Муниципальное образование': 'Центральный',
      'Населенный пункт': 'Москва',
      'Улица': 'Тверская',
      'Номер дома': '1',
      'Номер корпуса': '2',
      'Номер квартиры': '3',
      'Почтовый индекс': '123456',
      'Вид обращения': 'Жалоба',
      'Тема обращения': 'Бездействие',
      'Территориальный орган': 'УФССП по Москве',
      'Структурное подразделение ФССП России': 'Отдел 1',
      'Сотрудник ФССП': 'Иванов И.И.',
      'Текст обращения': 'Текст жалобы',
    }]);

    const result = parseExcelFile(buf);
    expect(result).toHaveLength(1);
    const c = result[0];
    expect(c.orgName).toBe('ООО Тест');
    expect(c.region).toBe('Москва');
    expect(c.municipality).toBe('Центральный');
    expect(c.locality).toBe('Москва');
    expect(c.street).toBe('Тверская');
    expect(c.house).toBe('1');
    expect(c.building).toBe('2');
    expect(c.apartment).toBe('3');
    expect(c.postalCode).toBe('123456');
    expect(c.appealType).toBe('Жалоба');
    expect(c.appealTopic).toBe('Бездействие');
    expect(c.territorialBody).toBe('УФССП по Москве');
    expect(c.structuralUnit).toBe('Отдел 1');
    expect(c.fsspEmployee).toBe('Иванов И.И.');
    expect(c.appealText).toBe('Текст жалобы');
  });

  it('parses multiple rows', () => {
    const buf = makeExcel([
      { 'Наименование организации': 'Компания 1', 'Текст обращения': 'Жалоба 1' },
      { 'Наименование организации': 'Компания 2', 'Текст обращения': 'Жалоба 2' },
      { 'Наименование организации': 'Компания 3', 'Текст обращения': 'Жалоба 3' },
    ]);

    const result = parseExcelFile(buf);
    expect(result).toHaveLength(3);
    expect(result[0].index).toBe(0);
    expect(result[1].index).toBe(1);
    expect(result[2].index).toBe(2);
  });

  it('recognizes column aliases (case-insensitive)', () => {
    const buf = makeExcel([{
      'организация': 'ООО Тест',
      'регион': 'Москва',
      'текст': 'Жалоба',
    }]);

    const result = parseExcelFile(buf);
    expect(result).toHaveLength(1);
    expect(result[0].orgName).toBe('ООО Тест');
    expect(result[0].region).toBe('Москва');
    expect(result[0].appealText).toBe('Жалоба');
  });

  it('skips empty rows (no org and no text)', () => {
    const buf = makeExcel([
      { 'Наименование организации': 'ООО Тест', 'Текст обращения': 'Жалоба' },
      { 'Наименование организации': '', 'Текст обращения': '' },
      { 'Наименование организации': '', 'Текст обращения': 'Только текст' },
    ]);

    const result = parseExcelFile(buf);
    expect(result).toHaveLength(2);
    expect(result[0].orgName).toBe('ООО Тест');
    expect(result[1].appealText).toBe('Только текст');
  });

  it('throws on empty file', () => {
    const ws = XLSX.utils.aoa_to_sheet([]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

    expect(() => parseExcelFile(buf)).toThrow('Файл пуст');
  });

  it('throws when no recognizable columns', () => {
    const buf = makeExcel([{
      'Колонка А': 'значение',
      'Колонка Б': 'значение',
    }]);

    expect(() => parseExcelFile(buf)).toThrow('Не удалось распознать колонки');
  });

  it('trims whitespace from values', () => {
    const buf = makeExcel([{
      'Наименование организации': '  ООО Пробелы  ',
      'Текст обращения': '  текст  ',
    }]);

    const result = parseExcelFile(buf);
    expect(result[0].orgName).toBe('ООО Пробелы');
    expect(result[0].appealText).toBe('текст');
  });

  it('returns empty string for missing optional fields', () => {
    const buf = makeExcel([{
      'Наименование организации': 'ООО Тест',
      'Текст обращения': 'Жалоба',
    }]);

    const result = parseExcelFile(buf);
    expect(result[0].street).toBe('');
    expect(result[0].building).toBe('');
    expect(result[0].fsspEmployee).toBe('');
  });
});

describe('validateComplaints', () => {
  const base: Complaint = {
    index: 0, orgName: 'ООО Тест', region: '', municipality: '', locality: '',
    street: '', house: '', building: '', apartment: '', postalCode: '',
    appealType: '', appealTopic: '', territorialBody: '', structuralUnit: '',
    fsspEmployee: '', appealText: 'Жалоба',
  };

  it('returns empty array for valid complaints', () => {
    expect(validateComplaints([base])).toEqual([]);
  });

  it('warns about missing appeal text', () => {
    const errors = validateComplaints([{ ...base, appealText: '' }]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('текста обращения');
  });

  it('warns about missing org name', () => {
    const errors = validateComplaints([{ ...base, orgName: '' }]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('организации');
  });

  it('reports both errors at once', () => {
    const errors = validateComplaints([{ ...base, orgName: '', appealText: '' }]);
    expect(errors).toHaveLength(2);
  });

  it('formats multiple row numbers', () => {
    const complaints = Array.from({ length: 3 }, (_, i) => ({
      ...base, index: i, appealText: '',
    }));
    const errors = validateComplaints(complaints);
    expect(errors[0]).toContain('1, 2, 3');
  });

  it('truncates long row lists with "и ещё"', () => {
    const complaints = Array.from({ length: 8 }, (_, i) => ({
      ...base, index: i, appealText: '',
    }));
    const errors = validateComplaints(complaints);
    expect(errors[0]).toContain('и ещё 3');
  });
});
