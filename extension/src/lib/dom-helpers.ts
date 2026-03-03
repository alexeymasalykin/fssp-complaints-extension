// DOM-хелперы для работы с Angular-формами на Госуслугах (EPGU)
// Госуслуги используют Angular + EPGU-компоненты, НЕ React

import type { GosuslugiStep } from '@/types';

// === Заполнение input через execCommand ===
// Content script работает в изолированном мире Chrome.
// dispatchEvent создаёт untrusted события (isTrusted=false).
// Angular/EPGU может игнорировать untrusted события.
// document.execCommand('insertText') создаёт TRUSTED события
// и надёжно работает с любым фреймворком.

export function setInputValue(element: HTMLInputElement, value: string): void {
  // Focus and select all existing content
  element.focus();
  element.select();

  // Strategy 1: execCommand creates trusted input events
  const inserted = document.execCommand('insertText', false, value);

  if (inserted && element.value === value) {
    element.blur();
    return;
  }

  // Strategy 2: native setter + events (fallback)
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  )?.set;

  if (setter) {
    setter.call(element, value);
  } else {
    element.value = value;
  }

  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.blur();
}

// === Ожидание элемента в DOM через MutationObserver ===

export function waitForElement(
  selector: string,
  textContent?: string,
  timeout = 30000
): Promise<Element> {
  return new Promise((resolve, reject) => {
    const existing = findElement(selector, textContent);
    if (existing) return resolve(existing);

    const observer = new MutationObserver(() => {
      const el = findElement(selector, textContent);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout: "${selector}" (text: "${textContent ?? '-'}") not found in ${timeout}ms`));
    }, timeout);
  });
}

function findElement(selector: string, textContent?: string): Element | null {
  if (textContent) {
    const elements = document.querySelectorAll(selector);
    return Array.from(elements).find((el) =>
      el.textContent?.includes(textContent)
    ) ?? null;
  }
  return document.querySelector(selector);
}

// === Определение текущего шага формы ===

export function getCurrentStep(): GosuslugiStep {
  const bodyText = document.body.innerText;

  // Step 1: document data
  if (/укажите\s+данные\s+документа/i.test(bodyText) ||
      /данные\s+документа.*удостоверяющего/i.test(bodyText)) {
    return 'document';
  }

  // Step 2: birth date
  if (/укажите\s+дату\s+рождения/i.test(bodyText) ||
      /дата\s+рождения\s+проверяемого/i.test(bodyText)) {
    return 'birthdate';
  }

  // Result page
  if (/отсутствует\s+в\s+реестре/i.test(bodyText) ||
      /состоит\s+в\s+реестре/i.test(bodyText) ||
      /данные\s+получены\s+из\s+системы\s+МВД/i.test(bodyText)) {
    return 'result';
  }

  // Intro page
  if (/поиск\s+иностранца/i.test(bodyText) ||
      (bodyText.includes('реестр') && hasButton('Начать'))) {
    return 'intro';
  }

  // Loading / transition page — expected between steps, no warning needed
  if (/загружается/i.test(bodyText) ||
      /подождите/i.test(bodyText) ||
      /проверка\s+данных/i.test(bodyText) ||
      bodyText.trim().length < 200) {
    return 'unknown';
  }

  return 'unknown';
}

function hasButton(text: string): boolean {
  const buttons = document.querySelectorAll(BUTTON_SELECTOR);
  return Array.from(buttons).some((btn) => btn.textContent?.trim().includes(text));
}

// === Поиск input-поля по label/placeholder/name ===

export function findInputByLabel(labelTexts: string[]): HTMLInputElement | null {
  // By label element text
  for (const text of labelTexts) {
    const labels = document.querySelectorAll('label');
    for (const label of labels) {
      if (!label.textContent?.toLowerCase().includes(text.toLowerCase())) continue;

      const input = label.querySelector('input') as HTMLInputElement | null;
      if (input) return input;

      const container = label.closest('.form-group, [class*="field"], [class*="input"]');
      const containerInput = container?.querySelector('input') as HTMLInputElement | null;
      if (containerInput) return containerInput;

      if (label.htmlFor) {
        const linked = document.getElementById(label.htmlFor) as HTMLInputElement | null;
        if (linked) return linked;
      }
    }
  }

  // By placeholder
  for (const text of labelTexts) {
    const inputs = document.querySelectorAll<HTMLInputElement>('input');
    for (const input of inputs) {
      if (input.placeholder?.toLowerCase().includes(text.toLowerCase())) return input;
    }
  }

  // By aria-label
  for (const text of labelTexts) {
    const input = document.querySelector<HTMLInputElement>(`input[aria-label*="${text}" i]`);
    if (input) return input;
  }

  return null;
}

// Search input by name attribute
export function findInputByName(namePatterns: string[]): HTMLInputElement | null {
  for (const pattern of namePatterns) {
    const input = document.querySelector<HTMLInputElement>(`input[name*="${pattern}"]`);
    if (input) return input;
  }
  return null;
}

// === Поиск полей шага 1 (документ) ===

interface DocumentInputs {
  series: HTMLInputElement | null;
  number: HTMLInputElement | null;
  issueDate: HTMLInputElement | null;
}

export function findDocumentInputs(): DocumentInputs | null {
  // By label
  const series = findInputByLabel(['Серия', 'серия']);
  const number = findInputByLabel(['Номер', 'номер'])
    ?? findInputByName(['number', 'doc_number', 'c_number']);
  const issueDate = findInputByLabel(['Дата выдачи', 'дата выдачи'])
    ?? findInputByName(['issue_date', 'doc_date', 'c_issue']);

  if (number && issueDate) {
    return { series, number, issueDate };
  }

  // Fallback: by order of visible text inputs
  const visible = getVisibleTextInputs();

  if (visible.length >= 2) {
    return {
      series: visible.length >= 3 ? visible[0] : null,
      number: visible.length >= 3 ? visible[1] : visible[0],
      issueDate: visible.length >= 3 ? visible[2] : visible[1],
    };
  }

  return null;
}

// === Поиск поля даты рождения (шаг 2) ===

export function findBirthdateInput(): HTMLInputElement | null {
  // By label (including short "Дата" which is the actual label on Gosuslugi)
  const input = findInputByLabel(['Дата рождения', 'дата рождения', 'Дата', 'дата']);
  if (input) return input;

  // By name attribute (Gosuslugi uses name="c_birth_date")
  const byName = findInputByName(['birth_date', 'birthdate', 'c_birth']);
  if (byName) return byName;

  // Fallback: first visible text input
  const visible = getVisibleTextInputs();
  return visible[0] ?? null;
}

// Get all visible text inputs on the page
function getVisibleTextInputs(): HTMLInputElement[] {
  const allInputs = document.querySelectorAll<HTMLInputElement>('input[type="text"], input:not([type])');
  return Array.from(allInputs).filter((input) => {
    const rect = input.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
}

// === Клик по кнопке с заданным текстом ===

// Broad selector for Angular EPGU components
const BUTTON_SELECTOR = 'button, [role="button"], a[href], a.button, [class*="button"], [class*="Button"], [class*="btn"], [class*="Btn"], lib-button, epgu-constructor-screen-buttons';

// Click element — remove disabled if needed, use native .click()
function performClick(element: HTMLElement): void {
  // Remove disabled attribute if present (Angular disables buttons when form is invalid)
  const wasDisabled = element.hasAttribute('disabled');
  if (wasDisabled) {
    element.removeAttribute('disabled');
    element.classList.remove('disabled');
  }

  // Native .click() — works across all frameworks
  element.click();
}

// Find a button by text — returns the element or null
function findButtonElement(buttonText: string): HTMLElement | null {
  // Strategy 1: search by selector
  const buttons = document.querySelectorAll(BUTTON_SELECTOR);
  for (const btn of buttons) {
    const text = btn.textContent?.trim() ?? '';
    if (text.includes(buttonText)) {
      // If the found element is a container, look for the actual <button> inside
      const innerButton = btn.querySelector('button') as HTMLElement | null;
      if (innerButton) return innerButton;
      return btn as HTMLElement;
    }
  }

  // Strategy 2: TreeWalker for custom Angular components
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.textContent?.trim().includes(buttonText)) continue;

    let target = node.parentElement;
    while (target && target !== document.body) {
      const style = getComputedStyle(target);
      const isClickable = style.cursor === 'pointer' ||
        target.tagName === 'BUTTON' ||
        target.tagName === 'A' ||
        target.hasAttribute('role');

      if (isClickable) return target;
      target = target.parentElement;
    }
  }

  return null;
}

export function clickButton(buttonText: string): boolean {
  const btn = findButtonElement(buttonText);
  if (!btn) return false;

  performClick(btn);
  return true;
}

// Wait for button to become enabled, then click
export async function waitAndClickButton(buttonText: string, timeout = 5000): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const btn = findButtonElement(buttonText);
    if (btn) {
      const isDisabled = btn.hasAttribute('disabled') || btn.classList.contains('disabled');
      if (!isDisabled) {
        performClick(btn);
        return true;
      }
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  // Last resort: force click even if disabled
  const btn = findButtonElement(buttonText);
  if (btn) {
    performClick(btn);
    return true;
  }
  return false;
}

// === Чтение результата проверки ===

export interface GosuslugiResult {
  found: boolean;
  timestamp: string;
  source: string;
}

export function readResult(): GosuslugiResult {
  const bodyText = document.body.innerText;
  const found = !bodyText.includes('Отсутствует в реестре');

  const dateMatch = bodyText.match(/(\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}\s+МСК)/);

  return {
    found,
    timestamp: dateMatch?.[1] ?? new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }),
    source: 'Госуслуги / МВД России',
  };
}

// === Диагностика DOM ===

export function debugDOM(): string {
  const lines: string[] = [];

  lines.push('=== RKL Check DOM Debug ===');
  lines.push(`URL: ${location.href}`);
  lines.push(`Title: ${document.title}`);
  lines.push('');

  const clickables = document.querySelectorAll('button, [role="button"], a[href], [class*="button"], [class*="Button"], [class*="btn"], [class*="Btn"]');
  lines.push(`--- Buttons (${clickables.length}) ---`);
  clickables.forEach((el, i) => {
    const html = el as HTMLElement;
    const rect = html.getBoundingClientRect();
    const visible = rect.width > 0 && rect.height > 0;
    const disabled = html.hasAttribute('disabled');
    const text = html.textContent?.trim().slice(0, 80) ?? '';
    lines.push(`[${i}] <${html.tagName.toLowerCase()}> class="${html.className.slice(0, 60)}" visible=${visible} disabled=${disabled} text="${text}"`);
    lines.push(`     outerHTML: ${html.outerHTML.slice(0, 200)}`);
  });

  lines.push('');

  const inputs = document.querySelectorAll('input, textarea, select');
  lines.push(`--- Inputs (${inputs.length}) ---`);
  inputs.forEach((el, i) => {
    const input = el as HTMLInputElement;
    const rect = input.getBoundingClientRect();
    const visible = rect.width > 0 && rect.height > 0;
    const label = input.closest('label')?.textContent?.trim().slice(0, 50) ??
      input.getAttribute('aria-label') ??
      input.placeholder ?? '';
    lines.push(`[${i}] <${input.tagName.toLowerCase()}> type="${input.type}" name="${input.name}" visible=${visible} value="${input.value}" label="${label}"`);
  });

  lines.push('');
  lines.push('--- Page text (500 chars) ---');
  lines.push(document.body.innerText.slice(0, 500));

  return lines.join('\n');
}

// === Случайная задержка (имитация человека) ===

export function humanDelay(minMs = 300, maxMs = 800): Promise<void> {
  const delay = minMs + Math.random() * (maxMs - minMs);
  return new Promise((resolve) => setTimeout(resolve, delay));
}
