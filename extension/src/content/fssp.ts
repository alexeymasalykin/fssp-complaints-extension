// Content Script — fills FSSP complaint form at fssp.gov.ru
// Regular HTML form (not Angular SPA), standard DOM manipulation

import type { Complaint } from '@/types';
import type { BackgroundToContentMessage, BaseResponse, FillResponse } from '@/lib/messages';

// Notify background that content script is ready
chrome.runtime.sendMessage({ type: 'CONTENT_READY' }).catch(() => {});

// === Form filling ===

async function fillForm(complaint: Complaint): Promise<FillResponse> {
  const skipped: string[] = [];
  let filled = 0;

  // Select "Юридическое лицо" radio
  const legalRadio = document.querySelector<HTMLInputElement>(
    'input[type="radio"][value*="Юридическое"]'
  ) ?? findRadioByLabel('Юридическое лицо');
  if (legalRadio && !legalRadio.checked) {
    legalRadio.click();
    await sleep(500);
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

  // Select fields (cascading — order matters, wait between)
  if (complaint.region) {
    filled += await fillSelectField('Субъект РФ', complaint.region, skipped);
    await sleep(1000); // Wait for municipality options to load
  }

  if (complaint.municipality) {
    filled += await fillSelectField('Муниципальное образование', complaint.municipality, skipped);
    await sleep(500);
  }

  if (complaint.street) {
    // Street may be a select or text input depending on page state
    const streetSelect = findSelectByLabel('Улица');
    if (streetSelect) {
      filled += await selectOptionByText(streetSelect, complaint.street, 'Улица', skipped);
    } else {
      filled += fillTextField('Улица', complaint.street, skipped);
    }
  }

  if (complaint.appealType) {
    filled += await fillSelectField('Вид обращения', complaint.appealType, skipped);
    await sleep(500);
  }

  if (complaint.appealTopic) {
    filled += await fillSelectField('Тема обращения', complaint.appealTopic, skipped);
    await sleep(500);
  }

  if (complaint.territorialBody) {
    filled += await fillSelectField('Территориальный орган', complaint.territorialBody, skipped);
  }

  return { ok: true, filledFields: filled, skippedFields: skipped.length ? skipped : undefined };
}

// === Field helpers ===

function fillTextField(labelText: string, value: string, skipped: string[]): number {
  if (!value) return 0;

  const input = findInputByLabelText(labelText);
  if (!input) {
    skipped.push(labelText);
    return 0;
  }

  setNativeValue(input, value);
  return 1;
}

function fillTextArea(labelText: string, value: string, skipped: string[]): number {
  if (!value) return 0;

  const textarea = findTextAreaByLabel(labelText);
  if (!textarea) {
    skipped.push(labelText);
    return 0;
  }

  setNativeValue(textarea, value);
  return 1;
}

async function fillSelectField(labelText: string, optionText: string, skipped: string[]): Promise<number> {
  if (!optionText) return 0;

  const select = findSelectByLabel(labelText);
  if (!select) {
    skipped.push(labelText);
    return 0;
  }

  return selectOptionByText(select, optionText, labelText, skipped);
}

async function selectOptionByText(
  select: HTMLSelectElement,
  optionText: string,
  labelText: string,
  skipped: string[]
): Promise<number> {
  const normalizedTarget = optionText.trim().toLowerCase();

  // Find option by text (exact or partial match)
  const options = Array.from(select.options);
  const match = options.find(o => o.text.trim().toLowerCase() === normalizedTarget)
    ?? options.find(o => o.text.trim().toLowerCase().includes(normalizedTarget));

  if (!match) {
    skipped.push(`${labelText} (значение "${optionText}" не найдено)`);
    return 0;
  }

  select.value = match.value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  return 1;
}

// === DOM search helpers ===

function findInputByLabelText(text: string): HTMLInputElement | null {
  const lower = text.toLowerCase();

  // By label text content
  const labels = document.querySelectorAll('label');
  for (const label of labels) {
    if (!label.textContent?.toLowerCase().includes(lower)) continue;

    // Input inside label
    const input = label.querySelector('input') as HTMLInputElement | null;
    if (input) return input;

    // Input linked by for/id
    if (label.htmlFor) {
      const linked = document.getElementById(label.htmlFor) as HTMLInputElement | null;
      if (linked) return linked;
    }

    // Input as next sibling or in same container
    const container = label.closest('.form-group, .field, div');
    const nearby = container?.querySelector('input:not([type="radio"]):not([type="checkbox"])') as HTMLInputElement | null;
    if (nearby) return nearby;
  }

  // By placeholder
  const inputs = document.querySelectorAll<HTMLInputElement>('input');
  for (const input of inputs) {
    if (input.placeholder?.toLowerCase().includes(lower)) return input;
  }

  return null;
}

function findTextAreaByLabel(text: string): HTMLTextAreaElement | null {
  const lower = text.toLowerCase();

  const labels = document.querySelectorAll('label');
  for (const label of labels) {
    if (!label.textContent?.toLowerCase().includes(lower)) continue;

    const textarea = label.querySelector('textarea') as HTMLTextAreaElement | null;
    if (textarea) return textarea;

    if (label.htmlFor) {
      const linked = document.getElementById(label.htmlFor) as HTMLTextAreaElement | null;
      if (linked) return linked;
    }

    const container = label.closest('.form-group, .field, div');
    const nearby = container?.querySelector('textarea') as HTMLTextAreaElement | null;
    if (nearby) return nearby;
  }

  // Fallback: find by nearby text
  const textareas = document.querySelectorAll<HTMLTextAreaElement>('textarea');
  for (const ta of textareas) {
    const parent = ta.closest('div');
    if (parent?.textContent?.toLowerCase().includes(lower)) return ta;
  }

  return null;
}

function findSelectByLabel(text: string): HTMLSelectElement | null {
  const lower = text.toLowerCase();

  const labels = document.querySelectorAll('label');
  for (const label of labels) {
    if (!label.textContent?.toLowerCase().includes(lower)) continue;

    const select = label.querySelector('select') as HTMLSelectElement | null;
    if (select) return select;

    if (label.htmlFor) {
      const linked = document.getElementById(label.htmlFor) as HTMLSelectElement | null;
      if (linked) return linked;
    }

    const container = label.closest('.form-group, .field, div');
    const nearby = container?.querySelector('select') as HTMLSelectElement | null;
    if (nearby) return nearby;
  }

  // Fallback: search by text near select
  const allSelects = document.querySelectorAll<HTMLSelectElement>('select');
  for (const sel of allSelects) {
    const parent = sel.closest('div');
    const prevText = parent?.querySelector('label, span, p, div');
    if (prevText?.textContent?.toLowerCase().includes(lower)) return sel;
  }

  return null;
}

function findRadioByLabel(text: string): HTMLInputElement | null {
  const lower = text.toLowerCase();
  const labels = document.querySelectorAll('label');
  for (const label of labels) {
    if (!label.textContent?.toLowerCase().includes(lower)) continue;
    const radio = label.querySelector('input[type="radio"]') as HTMLInputElement | null;
    if (radio) return radio;
  }
  return null;
}

// === Value setting ===

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  // Use native setter to bypass any framework wrappers
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

// === Message handler ===

chrome.runtime.onMessage.addListener(
  (message: BackgroundToContentMessage, _sender, sendResponse: (r: BaseResponse | FillResponse) => void) => {
    handleMessage(message)
      .then(sendResponse)
      .catch((err: unknown) => {
        const errMsg = err instanceof Error ? err.message : String(err);
        sendResponse({ ok: false, error: errMsg });
      });
    return true; // async response
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
