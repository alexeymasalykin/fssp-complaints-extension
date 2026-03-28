// Pure matching functions for vue-select option selection
// Extracted for testability — no DOM dependencies

/**
 * Stem a Russian word by trimming last 2 chars (simple declension handler).
 * Words of 4 chars or fewer are returned as-is.
 */
export function stem(word: string): string {
  return word.length <= 4 ? word : word.slice(0, word.length - 2);
}

/**
 * Split text into words suitable for stem comparison.
 * Filters out words shorter than 3 chars.
 */
export function tokenize(text: string): string[] {
  return text.trim().toLowerCase().split(/[\s\-()]+/).filter(w => w.length >= 3);
}

/** Exact match (case-insensitive, trimmed) */
export function exactMatch(search: string, option: string): boolean {
  return search.trim().toLowerCase() === option.trim().toLowerCase();
}

/** Partial match — one string contains the other */
export function partialMatch(search: string, option: string): boolean {
  const s = search.trim().toLowerCase();
  const o = option.trim().toLowerCase();
  return o.includes(s) || s.includes(o);
}

/**
 * Stem overlap score between search and option text.
 * Returns 0..1 — fraction of search stems found in option stems.
 */
export function stemScore(search: string, option: string): number {
  const searchStems = tokenize(search).map(stem);
  const optStems = tokenize(option).map(stem);

  if (searchStems.length === 0) return 0;

  const matchCount = searchStems.filter(ss =>
    optStems.some(os => os === ss || os.includes(ss) || ss.includes(os))
  ).length;

  return matchCount / searchStems.length;
}

export interface MatchResult {
  index: number;
  strategy: 'exact' | 'partial' | 'stem' | 'single';
  score?: number;
}

/**
 * Find best matching option from a list of option texts.
 * Applies strategies in order: exact → partial (shortest) → stem (≥40%) → single fallback.
 */
export function findBestMatch(search: string, options: string[]): MatchResult | null {
  const normalized = search.trim().toLowerCase();

  // Filter out empty / placeholder options
  const validOptions = options.map((text, index) => ({ text: text.trim().toLowerCase(), index }))
    .filter(o => o.text && o.text !== 'нет данных' && o.text !== 'loading');

  // 1. Exact match
  for (const opt of validOptions) {
    if (opt.text === normalized) {
      return { index: opt.index, strategy: 'exact' };
    }
  }

  // 2. Partial match — prefer shortest
  let bestPartial: { index: number; len: number } | null = null;
  for (const opt of validOptions) {
    if (opt.text.length > 200) continue;
    if (opt.text.includes(normalized) || normalized.includes(opt.text)) {
      if (!bestPartial || opt.text.length < bestPartial.len) {
        bestPartial = { index: opt.index, len: opt.text.length };
      }
    }
  }
  if (bestPartial) {
    return { index: bestPartial.index, strategy: 'partial' };
  }

  // 3. Stem match (≥40% overlap)
  const searchStems = tokenize(normalized).map(stem);
  if (searchStems.length >= 1) {
    let bestScore = 0;
    let bestIndex = -1;
    for (const opt of validOptions) {
      const score = stemScore(normalized, opt.text);
      if (score > bestScore && score >= 0.4) {
        bestScore = score;
        bestIndex = opt.index;
      }
    }
    if (bestIndex >= 0) {
      return { index: bestIndex, strategy: 'stem', score: bestScore };
    }
  }

  // 4. Single option fallback
  if (validOptions.length === 1) {
    return { index: validOptions[0].index, strategy: 'single' };
  }

  return null;
}
