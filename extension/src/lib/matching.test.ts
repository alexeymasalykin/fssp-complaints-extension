import { describe, it, expect } from 'vitest';
import { stem, tokenize, exactMatch, partialMatch, stemScore, findBestMatch } from './matching';

describe('stem', () => {
  it('returns short words as-is (≤4 chars)', () => {
    expect(stem('дом')).toBe('дом');
    expect(stem('река')).toBe('река');
  });

  it('trims last 2 chars from longer words', () => {
    expect(stem('москва')).toBe('моск');
    expect(stem('москве')).toBe('моск');
    expect(stem('действия')).toBe('действ');
    expect(stem('действий')).toBe('действ');
  });

  it('handles Russian regions', () => {
    expect(stem('ленинградская')).toBe('ленинградск');
    expect(stem('ленинградской')).toBe('ленинградск');
  });
});

describe('tokenize', () => {
  it('splits by spaces and filters short words', () => {
    expect(tokenize('Москва и область')).toEqual(['москва', 'область']);
  });

  it('splits by hyphens and parentheses', () => {
    expect(tokenize('Санкт-Петербург (город)')).toEqual(['санкт', 'петербург', 'город']);
  });

  it('returns empty for short text', () => {
    expect(tokenize('да')).toEqual([]);
  });
});

describe('exactMatch', () => {
  it('matches case-insensitively', () => {
    expect(exactMatch('Москва', 'москва')).toBe(true);
    expect(exactMatch('МОСКВА', 'москва')).toBe(true);
  });

  it('trims whitespace', () => {
    expect(exactMatch('  Москва  ', 'Москва')).toBe(true);
  });

  it('rejects different strings', () => {
    expect(exactMatch('Москва', 'Москве')).toBe(false);
  });
});

describe('partialMatch', () => {
  it('matches when option contains search', () => {
    expect(partialMatch('Москва', 'г. Москва')).toBe(true);
  });

  it('matches when search contains option', () => {
    expect(partialMatch('Ленинградская область', 'Ленинградская')).toBe(true);
  });

  it('rejects unrelated strings', () => {
    expect(partialMatch('Москва', 'Петербург')).toBe(false);
  });
});

describe('stemScore', () => {
  it('returns 1.0 for identical stems', () => {
    expect(stemScore('Москва', 'Москве')).toBe(1);
  });

  it('handles multi-word with partial stem overlap', () => {
    const score = stemScore('Ленинградская область', 'Ленинградской области');
    expect(score).toBe(1);
  });

  it('returns 0 for completely different words', () => {
    expect(stemScore('Москва', 'Петербург')).toBe(0);
  });

  it('returns partial score for mixed overlap', () => {
    const score = stemScore('Управление ФССП Москва', 'Управление ФССП Петербург');
    // "управлен" matches, "фссп" matches (≤4 chars), "москва"→"моск" vs "петербург"→"петербу" — no match
    // 2/3 ≈ 0.667
    expect(score).toBeCloseTo(0.667, 1);
  });
});

describe('findBestMatch', () => {
  const regions = [
    'Москва',
    'Московская область',
    'Санкт-Петербург',
    'Ленинградская область',
    'Нет данных',
  ];

  it('finds exact match first', () => {
    const result = findBestMatch('Москва', regions);
    expect(result).toEqual({ index: 0, strategy: 'exact' });
  });

  it('finds partial match (option contains search)', () => {
    const result = findBestMatch('Ленинградская', regions);
    expect(result).toEqual({ index: 3, strategy: 'partial' });
  });

  it('finds stem match for declensions', () => {
    const options = ['Московской области', 'Санкт-Петербурга', 'Ленинградской области'];
    const result = findBestMatch('Ленинградская область', options);
    expect(result?.strategy).toBe('stem');
    expect(result?.index).toBe(2);
  });

  it('uses single fallback when only one valid option', () => {
    const result = findBestMatch('что угодно', ['Единственный вариант']);
    expect(result).toEqual({ index: 0, strategy: 'single' });
  });

  it('ignores "нет данных" placeholder', () => {
    const result = findBestMatch('что угодно', ['Нет данных', 'Реальный вариант']);
    expect(result).toEqual({ index: 1, strategy: 'single' });
  });

  it('returns null when no match found', () => {
    const result = findBestMatch('Владивосток', regions);
    expect(result).toBeNull();
  });

  it('prefers exact over partial', () => {
    const options = ['Москва', 'г. Москва, столица'];
    const result = findBestMatch('Москва', options);
    expect(result?.strategy).toBe('exact');
    expect(result?.index).toBe(0);
  });

  it('prefers shorter partial match', () => {
    const options = ['Московская область — центральный регион', 'Московская область'];
    const result = findBestMatch('Московская', options);
    expect(result?.strategy).toBe('partial');
    expect(result?.index).toBe(1);
  });
});
