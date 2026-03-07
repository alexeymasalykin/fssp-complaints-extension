// Content Script — fills FSSP complaint form at fssp.gov.ru
// Site is a Vue.js SPA with custom select components (not native <select>)
// Dropdowns load options via API (/api/is/kladr/regions/, /api/is/appeals/types, etc.)

import type { Complaint } from '@/types';
import type { BackgroundToContentMessage, BaseResponse, FillResponse } from '@/lib/messages';

// Notify background that content script is ready
chrome.runtime.sendMessage({ type: 'CONTENT_READY' }).catch(() => {});

// === Form filling ===

// Track elements already used to avoid filling the same input/select twice
const usedElements = new WeakSet<Element>();

async function fillForm(complaint: Complaint): Promise<FillResponse> {
  const skipped: string[] = [];
  let filled = 0;

  console.log('[FSSP] Starting form fill. DOM snapshot:', debugDOM());

  // Select "Юридическое лицо" radio
  const legalRadio = findRadioByLabel('Юридическое лицо');
  if (legalRadio && !legalRadio.checked) {
    legalRadio.click();
    await sleep(800);
    console.log('[FSSP] Selected "Юридическое лицо" radio');
  }

  // Text fields
  filled += fillTextField('Наименование организации', complaint.orgName, skipped);
  filled += fillTextField('Номер дома', complaint.house, skipped);
  filled += fillTextField('Номер корпуса', complaint.building, skipped);
  filled += fillTextField('Номер квартиры', complaint.apartment, skipped);
  filled += fillTextField('Почтовый индекс', complaint.postalCode, skipped);
  filled += fillTextField('Сотрудник ФССП', complaint.fsspEmployee, skipped);

  // Textarea
  filled += fillTextArea('Текст обращения', complaint.appealText, skipped);

  // Vue custom select fields (cascading — order matters, wait between)
  if (complaint.region) {
    filled += await fillVueSelect('Субъект РФ', complaint.region, skipped);
    await sleep(1500); // Wait for dependent fields to load via API
  }

  if (complaint.municipality) {
    filled += await fillVueSelect('Муниципальное образование', complaint.municipality, skipped);
    await sleep(1000);
  }

  if (complaint.street) {
    filled += await fillVueSelect('Улица', complaint.street, skipped);
    await sleep(500);
  }

  if (complaint.appealType) {
    filled += await fillVueSelect('Вид обращения', complaint.appealType, skipped);
    await sleep(1000);
  }

  if (complaint.appealTopic) {
    filled += await fillVueSelect('Тема обращения', complaint.appealTopic, skipped);
    await sleep(1000);
  }

  if (complaint.territorialBody) {
    filled += await fillVueSelect('Территориальный орган', complaint.territorialBody, skipped);
    await sleep(2000); // Wait for departments API to load
  }

  if (complaint.structuralUnit) {
    // Wait for field to become enabled (depends on territorial body API response)
    for (let wait = 0; wait < 5; wait++) {
      const allVSelects = document.querySelectorAll('.v-select');
      let enabled = false;
      for (const vs of allVSelects) {
        if (usedElements.has(vs)) continue;
        const inp = vs.querySelector('input.vs__search') as HTMLInputElement | null;
        if (inp && !inp.disabled) { enabled = true; break; }
      }
      if (enabled) break;
      console.log(`[FSSP] Waiting for "Структурное подразделение" to become enabled... (${wait + 1})`);
      await sleep(1000);
    }
    filled += await fillVueSelect('Структурное подразделение ФССП России', complaint.structuralUnit, skipped);
  }

  console.log('[FSSP] Fill complete. Filled:', filled, 'Skipped:', skipped);
  return { ok: true, filledFields: filled, skippedFields: skipped.length ? skipped : undefined };
}

// === Text field helpers ===

function fillTextField(labelText: string, value: string, skipped: string[]): number {
  if (!value) return 0;

  const input = findInputNearLabel(labelText);
  if (!input) {
    console.log(`[FSSP] Input NOT found: "${labelText}"`);
    skipped.push(labelText);
    return 0;
  }

  usedElements.add(input);
  setInputValue(input, value);
  console.log(`[FSSP] Filled input "${labelText}" = "${value}"`);
  return 1;
}

function fillTextArea(labelText: string, value: string, skipped: string[]): number {
  if (!value) return 0;

  const textarea = findTextAreaNearLabel(labelText);
  if (!textarea) {
    console.log(`[FSSP] Textarea NOT found: "${labelText}"`);
    skipped.push(labelText);
    return 0;
  }

  usedElements.add(textarea);
  setInputValue(textarea, value);
  console.log(`[FSSP] Filled textarea "${labelText}"`);
  return 1;
}

// === Vue custom select handling ===
// The site uses Vue components that render as:
// - A clickable trigger div (shows "Выберите" or selected value)
// - When clicked, opens a dropdown with a search input and option list
// - Options may be loaded via AJAX after opening

// vue-select (v-select) component structure:
// .v-select > .vs__dropdown-toggle > input.vs__search (search input)
// .v-select > .vs__dropdown-menu > li.vs__dropdown-option (options)

async function fillVueSelect(labelText: string, optionText: string, skipped: string[]): Promise<number> {
  if (!optionText) return 0;

  console.log(`[FSSP] Trying to fill vue-select "${labelText}" with "${optionText}"`);

  // Find the label text on page
  const labelEl = findLabelElement(labelText);
  if (!labelEl) {
    console.log(`[FSSP] Label not found for select: "${labelText}"`);
    skipped.push(labelText);
    return 0;
  }

  // Find the v-select container near the label
  const vSelect = findVSelect(labelEl);
  if (!vSelect) {
    console.log(`[FSSP] v-select not found near label: "${labelText}". Parent HTML:`, labelEl.parentElement?.outerHTML?.slice(0, 300));
    skipped.push(labelText);
    return 0;
  }

  usedElements.add(vSelect);

  // Find the search input inside v-select
  const searchInput = vSelect.querySelector('input.vs__search') as HTMLInputElement;
  if (!searchInput) {
    console.log(`[FSSP] Search input not found in v-select for "${labelText}"`);
    skipped.push(`${labelText} (поисковое поле не найдено)`);
    return 0;
  }

  // Check if field is disabled (cascading dependency not met)
  if (searchInput.disabled) {
    console.log(`[FSSP] v-select "${labelText}" is disabled (parent field not filled yet)`);
    skipped.push(`${labelText} (поле отключено — не заполнено родительское поле)`);
    return 0;
  }

  // Type and select — use execCommand for trusted events
  const clicked = await typeAndSelectVue(vSelect, searchInput, optionText, labelText);
  if (clicked) {
    console.log(`[FSSP] Selected option for "${labelText}"`);
    await sleep(500);
    return 1;
  }

  // Retry with shorter search term (first word)
  const shortSearch = optionText.split(' ')[0];
  if (shortSearch !== optionText && shortSearch.length >= 3) {
    console.log(`[FSSP] Retrying with shorter search: "${shortSearch}"`);
    const retryClicked = await typeAndSelectVue(vSelect, searchInput, shortSearch, labelText, optionText);
    if (retryClicked) {
      console.log(`[FSSP] Selected option for "${labelText}" on retry`);
      await sleep(500);
      return 1;
    }
  }

  // Close dropdown
  searchInput.blur();
  console.log(`[FSSP] Option "${optionText}" not found for "${labelText}"`);
  skipped.push(`${labelText} (значение "${optionText}" не найдено)`);
  return 0;
}

async function typeAndSelectVue(
  vSelect: HTMLElement,
  searchInput: HTMLInputElement,
  searchText: string,
  labelText: string,
  matchText?: string,
): Promise<boolean> {
  const target = matchText ?? searchText;

  // Step 1: Open dropdown — try multiple strategies
  // vue-select listens for mousedown on .vs__dropdown-toggle
  const toggle = vSelect.querySelector('.vs__dropdown-toggle') as HTMLElement;
  if (toggle) {
    // Strategy A: mousedown event (vue-select's native trigger)
    toggle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    await sleep(200);
  }

  let isOpen = vSelect.classList.contains('vs--open');
  console.log(`[FSSP] After mousedown: vs--open=${isOpen}`);

  if (!isOpen) {
    // Strategy B: click on toggle
    toggle?.click();
    await sleep(200);
    isOpen = vSelect.classList.contains('vs--open');
    console.log(`[FSSP] After toggle click: vs--open=${isOpen}`);
  }

  if (!isOpen) {
    // Strategy C: focus search input directly
    searchInput.focus();
    await sleep(200);
    isOpen = vSelect.classList.contains('vs--open');
    console.log(`[FSSP] After focus: vs--open=${isOpen}`);
  }

  if (!isOpen) {
    // Strategy D: inject script into MAIN world to open via Vue internals
    const opened = await openViaMainWorld(vSelect, searchInput);
    console.log(`[FSSP] After MAIN world open: ${opened}`);
    await sleep(200);
    isOpen = vSelect.classList.contains('vs--open');
  }

  if (!isOpen) {
    console.log(`[FSSP] Cannot open dropdown for "${labelText}"`);
    return false;
  }

  // Step 2: Wait for options to load (may auto-load from parent selection)
  let options: Element[] = [];
  for (let attempt = 0; attempt < 4; attempt++) {
    await sleep(500);
    options = findDropdownOptions(vSelect);
    if (options.length > 0) {
      console.log(`[FSSP] Pre-loaded ${options.length} options for "${labelText}" after ${(attempt + 1) * 500}ms`);
      break;
    }
  }

  // Step 3: Check if target exists in pre-loaded options; if not, type to filter
  const hasMatch = (opts: Element[]) => {
    const n = target.trim().toLowerCase();
    return opts.some(o => {
      const t = o.textContent?.trim().toLowerCase() ?? '';
      return t === n || t.includes(n) || n.includes(t);
    });
  };

  const prevCount = options.length;

  if (options.length === 0 || !hasMatch(options)) {
    if (options.length > 0) {
      console.log(`[FSSP] No match in ${options.length} pre-loaded options for "${labelText}", typing to filter`);
    }
    searchInput.focus();
    searchInput.select();
    document.execCommand('insertText', false, searchText);

    console.log(`[FSSP] Typed "${searchText}" for "${labelText}". value="${searchInput.value}", open=${vSelect.classList.contains('vs--open')}`);

    // Wait for filtered results — options must change from pre-loaded list
    for (let attempt = 0; attempt < 8; attempt++) {
      await sleep(500);
      options = findDropdownOptions(vSelect);
      // Accept if: options appeared (from 0), count changed, or match found
      if (options.length > 0 && (prevCount === 0 || options.length !== prevCount || hasMatch(options))) {
        console.log(`[FSSP] Found ${options.length} options after typing, ${(attempt + 1) * 500}ms`);
        break;
      }
    }
  }

  // Debug if no options found
  if (options.length === 0) {
    console.log(`[FSSP] 0 options for "${labelText}". open=${vSelect.classList.contains('vs--open')}, value="${searchInput.value}"`);
    console.log(`[FSSP] innerHTML:`, vSelect.innerHTML.slice(0, 600));
    return false;
  }

  // Log and click matching option
  const optTexts = Array.from(options).map(o => o.textContent?.trim()).filter(Boolean);
  console.log(`[FSSP] Options for "${labelText}": ${JSON.stringify(optTexts.slice(0, 10))}`);

  const normalized = target.trim().toLowerCase();

  // Helper: select option and close dropdown
  const selectOption = async (opt: HTMLElement): Promise<true> => {
    // vue-select selects on mousedown on li.vs__dropdown-option
    opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    await sleep(200);

    // Fallback: if mousedown didn't select (still open), try click
    if (vSelect.classList.contains('vs--open')) {
      opt.click();
      await sleep(200);
    }

    // Close dropdown if still open — toggle via mousedown on toggle
    if (vSelect.classList.contains('vs--open') && toggle) {
      toggle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      await sleep(100);
    }

    // Last resort: blur search input
    if (vSelect.classList.contains('vs--open')) {
      searchInput.blur();
    }

    return true;
  };

  // Exact match first
  for (const opt of options) {
    if (opt.textContent?.trim().toLowerCase() === normalized) {
      return selectOption(opt as HTMLElement);
    }
  }

  // Partial match — prefer shortest option text (closest to search)
  let bestPartial: HTMLElement | null = null;
  let bestPartialLen = Infinity;
  for (const opt of options) {
    const text = opt.textContent?.trim().toLowerCase() ?? '';
    if (!text || text === 'нет данных' || text.length > 200) continue;
    if (text.includes(normalized) || normalized.includes(text)) {
      if (text.length < bestPartialLen) {
        bestPartialLen = text.length;
        bestPartial = opt as HTMLElement;
      }
    }
  }
  if (bestPartial) {
    console.log(`[FSSP] Partial match: "${bestPartial.textContent?.trim()}" (len=${bestPartialLen})`);
    return selectOption(bestPartial);
  }

  // Word stem overlap — handles Russian declension (москва/москве, действия/действий)
  // Stem = first max(3, len-2) characters of each word
  const stem = (w: string) => w.length <= 4 ? w : w.slice(0, w.length - 2);
  const searchWords = normalized.split(/[\s\-()]+/).filter(w => w.length >= 3);
  const searchStems = searchWords.map(stem);

  if (searchStems.length >= 1) {
    let bestOpt: HTMLElement | null = null;
    let bestScore = 0;
    for (const opt of options) {
      const text = opt.textContent?.trim().toLowerCase() ?? '';
      if (!text) continue;
      const optWords = text.split(/[\s\-()]+/).filter(w => w.length >= 3);
      const optStems = optWords.map(stem);

      // How many search stems appear in option stems
      const matchCount = searchStems.filter(ss => optStems.some(os => os === ss || os.includes(ss) || ss.includes(os))).length;
      const score = matchCount / searchStems.length;
      if (score > bestScore && score >= 0.4) {
        bestScore = score;
        bestOpt = opt as HTMLElement;
      }
    }
    if (bestOpt) {
      console.log(`[FSSP] Stem match (${Math.round(bestScore * 100)}%): "${bestOpt.textContent?.trim()}"`);
      return selectOption(bestOpt);
    }
  }

  // Last resort: click first non-empty option if only one real option exists
  const realOptions = options.filter(o => {
    const t = o.textContent?.trim().toLowerCase() ?? '';
    return t && t !== 'нет данных' && t !== 'loading';
  });
  if (realOptions.length === 1) {
    console.log(`[FSSP] Single option fallback: "${realOptions[0].textContent?.trim()}"`);
    return selectOption(realOptions[0] as HTMLElement);
  }

  return false;
}

function findDropdownOptions(vSelect: HTMLElement): Element[] {
  // Check inside v-select dropdown menu ONLY (not selected values)
  const menu = vSelect.querySelector('.vs__dropdown-menu, [role="listbox"]');
  if (menu) {
    const options = Array.from(menu.querySelectorAll('.vs__dropdown-option, li[role="option"], li'));
    if (options.length > 0) return options;
  }

  // Check ARIA listbox by id (scoped to this v-select)
  const combobox = vSelect.querySelector('[role="combobox"]');
  const listboxId = combobox?.getAttribute('aria-owns');
  if (listboxId) {
    const listbox = document.getElementById(listboxId);
    if (listbox) {
      const options = Array.from(listbox.querySelectorAll('li'));
      if (options.length > 0) return options;
    }
  }

  // Do NOT search globally — it picks up selected values from other v-selects
  return [];
}

// Open vue-select dropdown via MAIN world script injection (bypasses ISOLATED world limitations)
async function openViaMainWorld(vSelect: HTMLElement, searchInput: HTMLInputElement): Promise<boolean> {
  // Use a data attribute to identify the element in MAIN world
  const markerId = `fssp_${Date.now()}`;
  vSelect.setAttribute('data-fssp-marker', markerId);

  const script = document.createElement('script');
  script.textContent = `
    (function() {
      var el = document.querySelector('[data-fssp-marker="${markerId}"]');
      if (!el) return;
      el.removeAttribute('data-fssp-marker');

      // Strategy 1: Vue 2 component instance
      var vm = el.__vue__;
      if (vm) {
        if (typeof vm.open !== 'undefined') vm.open = true;
        if (typeof vm.toggleDropdown === 'function') vm.toggleDropdown({ preventDefault: function(){} });
        return;
      }

      // Strategy 2: mousedown on toggle (in MAIN world = same context as Vue)
      var toggle = el.querySelector('.vs__dropdown-toggle');
      if (toggle) {
        toggle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      }

      // Strategy 3: focus search input
      var input = el.querySelector('input.vs__search');
      if (input) input.focus();
    })();
  `;
  document.documentElement.appendChild(script);
  script.remove();

  // Clean up marker
  vSelect.removeAttribute('data-fssp-marker');
  return true;
}

function findVSelect(labelEl: Element): HTMLElement | null {
  // Search for .v-select near the label element, skip already-used ones

  // Check siblings first (closest match)
  let next = labelEl.nextElementSibling;
  for (let i = 0; i < 5 && next; i++) {
    if (next.classList?.contains('v-select') && !usedElements.has(next)) return next as HTMLElement;
    const inner = next.querySelector('.v-select') as HTMLElement;
    if (inner && !usedElements.has(inner)) return inner;
    next = next.nextElementSibling;
  }

  // Check direct parent only — going further up finds unrelated v-selects
  const parent = labelEl.parentElement;
  if (parent) {
    const allVSelects = parent.querySelectorAll('.v-select');
    for (const vsel of allVSelects) {
      if (!usedElements.has(vsel)) return vsel as HTMLElement;
    }
  }

  // Walk up to 5 levels to find v-select
  let ancestor: Element | null = parent?.parentElement ?? null;
  for (let level = 0; level < 4 && ancestor; level++) {
    const allVSelects = ancestor.querySelectorAll('.v-select');
    for (const vsel of allVSelects) {
      if (!usedElements.has(vsel)) return vsel as HTMLElement;
    }
    ancestor = ancestor.parentElement;
  }

  return null;
}


// === DOM search helpers ===

function findLabelElement(text: string): Element | null {
  const lower = text.toLowerCase();

  // Strategy 1: <label> elements
  const labels = document.querySelectorAll('label');
  for (const label of labels) {
    const labelText = label.textContent?.trim().toLowerCase() ?? '';
    if (labelText.includes(lower)) return label;
  }

  // Strategy 2: leaf-ish text elements (span, div, p)
  // Prefer shorter matches (more specific labels)
  let best: Element | null = null;
  let bestLen = Infinity;

  const candidates = document.querySelectorAll('span, div, p');
  for (const el of candidates) {
    const elText = el.textContent?.trim() ?? '';
    if (elText.length > 80 || elText.length < lower.length) continue;
    if (elText.toLowerCase().includes(lower) && elText.length < bestLen) {
      best = el;
      bestLen = elText.length;
    }
  }

  return best;
}

// Selector to exclude vue-select search inputs and other non-form inputs
const TEXT_INPUT_SELECTOR = 'input:not([type="radio"]):not([type="checkbox"]):not([type="hidden"]):not(.vs__search)';

function isUsableInput(el: Element | null): el is HTMLInputElement {
  return el !== null && !usedElements.has(el) && !el.classList.contains('vs__search');
}

function findInputNearLabel(text: string): HTMLInputElement | null {
  const labelEl = findLabelElement(text);
  if (!labelEl) {
    console.log(`[FSSP] Label element not found for: "${text}"`);
    return null;
  }

  // Input inside label
  const inside = labelEl.querySelector(TEXT_INPUT_SELECTOR) as HTMLInputElement | null;
  if (isUsableInput(inside)) return inside;

  // Linked by for/id
  if (labelEl instanceof HTMLLabelElement && labelEl.htmlFor) {
    const linked = document.getElementById(labelEl.htmlFor) as HTMLInputElement | null;
    if (isUsableInput(linked)) return linked;
  }

  // Next sibling or within next sibling (only check IMMEDIATE wrapper, not whole tree)
  let next = labelEl.nextElementSibling;
  for (let i = 0; i < 3 && next; i++) {
    if (next.tagName === 'INPUT' && isUsableInput(next as HTMLInputElement)) return next as HTMLInputElement;
    const nested = next.querySelector(TEXT_INPUT_SELECTOR) as HTMLInputElement | null;
    if (isUsableInput(nested)) return nested;
    next = next.nextElementSibling;
  }

  // Direct parent only (not grandparent — too broad)
  const parent = labelEl.parentElement;
  if (parent) {
    const inputs = parent.querySelectorAll<HTMLInputElement>(TEXT_INPUT_SELECTOR);
    for (const input of inputs) {
      if (isUsableInput(input)) return input;
    }
  }

  return null;
}

function findTextAreaNearLabel(text: string): HTMLTextAreaElement | null {
  const labelEl = findLabelElement(text);
  if (!labelEl) {
    // Fallback: find textarea near any text containing the label
    const lower = text.toLowerCase();
    const allTextareas = document.querySelectorAll<HTMLTextAreaElement>('textarea');
    for (const ta of allTextareas) {
      const parent = ta.closest('div');
      if (parent?.textContent?.toLowerCase().includes(lower)) return ta;
    }
    return null;
  }

  const ta = labelEl.querySelector('textarea') as HTMLTextAreaElement | null;
  if (ta) return ta;

  if (labelEl instanceof HTMLLabelElement && labelEl.htmlFor) {
    const linked = document.getElementById(labelEl.htmlFor) as HTMLTextAreaElement | null;
    if (linked) return linked;
  }

  let next = labelEl.nextElementSibling;
  for (let i = 0; i < 3 && next; i++) {
    if (next.tagName === 'TEXTAREA') return next as HTMLTextAreaElement;
    const nested = next.querySelector('textarea') as HTMLTextAreaElement | null;
    if (nested) return nested;
    next = next.nextElementSibling;
  }

  const parent = labelEl.parentElement;
  const nearby = parent?.querySelector('textarea') as HTMLTextAreaElement | null;
  return nearby;
}

function findRadioByLabel(text: string): HTMLInputElement | null {
  const lower = text.toLowerCase();
  // Search <label> elements
  const labels = document.querySelectorAll('label');
  for (const label of labels) {
    if (!label.textContent?.toLowerCase().includes(lower)) continue;
    const radio = label.querySelector('input[type="radio"]') as HTMLInputElement | null;
    if (radio) return radio;
  }
  // By value attribute
  const radios = document.querySelectorAll<HTMLInputElement>('input[type="radio"]');
  for (const radio of radios) {
    if (radio.value?.toLowerCase().includes(lower)) return radio;
    const parent = radio.closest('label, div, span');
    if (parent?.textContent?.toLowerCase().includes(lower)) return radio;
  }
  return null;
}

// === Value setting ===

function setInputValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  element.focus();

  // Try execCommand first (creates trusted events)
  element.select();
  const inserted = document.execCommand('insertText', false, value);

  if (inserted && element.value === value) {
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }

  // Fallback: native setter + events
  const proto = element instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;

  if (setter) {
    setter.call(element, value);
  } else {
    element.value = value;
  }

  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

// === Debug ===

function debugDOM(): string {
  const lines: string[] = [];

  // All form elements
  const formEls = document.querySelectorAll('input:not([type="hidden"]), textarea, select');
  lines.push(`--- Form elements: ${formEls.length} ---`);
  formEls.forEach((el, i) => {
    const tag = el.tagName.toLowerCase();
    const type = (el as HTMLInputElement).type || '';
    const name = (el as HTMLInputElement).name || '';
    const id = el.id || '';
    const placeholder = (el as HTMLInputElement).placeholder || '';
    const cls = el.className?.slice?.(0, 40) || '';
    const parentCls = el.parentElement?.className?.slice?.(0, 40) || '';
    lines.push(`  [${i}] <${tag}> type="${type}" name="${name}" id="${id}" ph="${placeholder}" class="${cls}" parentClass="${parentCls}"`);
  });

  // Potential select components (divs with select/dropdown classes)
  const selectDivs = document.querySelectorAll('[class*="select"], [class*="dropdown"], [class*="chosen"]');
  lines.push(`--- Select-like divs: ${selectDivs.length} ---`);
  selectDivs.forEach((el, i) => {
    if (i > 15) return; // Limit output
    const text = el.textContent?.trim().slice(0, 60) ?? '';
    const cls = el.className?.slice?.(0, 80) || '';
    const tag = el.tagName.toLowerCase();
    lines.push(`  [${i}] <${tag}> class="${cls}" text="${text}"`);
  });

  return '\n' + lines.join('\n');
}

// === Message handler ===

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse: (r: BaseResponse | FillResponse) => void) => {
    const msg = message as { type: string };

    if (msg.type === 'PING') {
      sendResponse({ ok: true });
      return;
    }

    handleMessage(message as BackgroundToContentMessage)
      .then(sendResponse)
      .catch((err: unknown) => {
        const errMsg = err instanceof Error ? err.message : String(err);
        sendResponse({ ok: false, error: errMsg });
      });
    return true;
  }
);

async function handleMessage(message: BackgroundToContentMessage): Promise<BaseResponse | FillResponse> {
  switch (message.type) {
    case 'FILL_FORM':
      return fillForm(message.complaint);
    default:
      return { ok: false, error: 'Unknown command' };
  }
}

// === Utils ===

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
