// Content Script — робот для работы с формой проверки РКЛ на Госуслугах
// Работает на: https://www.gosuslugi.ru/655781/*
// Angular EPGU forms — DOM-манипуляции по команде от background worker

import type { BackgroundToContentMessage, BaseResponse, StepResponse, ReadResultResponse } from '@/lib/messages';
import {
  setInputValue,
  getCurrentStep,
  findDocumentInputs,
  findBirthdateInput,
  clickButton,
  waitAndClickButton,
  readResult,
  humanDelay,
  debugDOM,
} from '@/lib/dom-helpers';

// Notify background that content script is ready
chrome.runtime.sendMessage({ type: 'CONTENT_READY' }).catch(() => {});

// === Step 1: fill document fields ===

async function fillDocumentStep(data: { series: string; number: string; issueDate: string }): Promise<void> {
  const inputs = findDocumentInputs();
  if (!inputs) throw new Error('Document input fields not found');
  if (!inputs.number) throw new Error('Field "Number" not found');
  if (!inputs.issueDate) throw new Error('Field "Issue date" not found');

  // Series (if field exists and data provided)
  if (inputs.series && data.series) {
    setInputValue(inputs.series, data.series);
    await humanDelay(200, 400);
  }

  // Number
  setInputValue(inputs.number, data.number);
  await humanDelay(200, 400);

  // Issue date
  setInputValue(inputs.issueDate, data.issueDate);
  await humanDelay(300, 500);

  // Wait for Angular validation and click "Продолжить"
  const clicked = await waitAndClickButton('Продолжить', 3000);
  if (!clicked) {
    throw new Error('Button "Продолжить" not found or not clickable');
  }
}

// === Step 2: fill birth date ===

async function fillBirthdateStep(data: { birthDate: string }): Promise<void> {
  const input = findBirthdateInput();
  if (!input) throw new Error('Birth date field not found');

  setInputValue(input, data.birthDate);
  await humanDelay(300, 500);

  // Wait for Angular validation and click "Продолжить"
  const clicked = await waitAndClickButton('Продолжить', 3000);
  if (!clicked) {
    throw new Error('Button "Продолжить" not found or not clickable');
  }
}

// === Message handler ===

type ContentResponse = BaseResponse | StepResponse | ReadResultResponse;

chrome.runtime.onMessage.addListener(
  (message: BackgroundToContentMessage, _sender, sendResponse: (r: ContentResponse) => void) => {
    handleMessage(message)
      .then(sendResponse)
      .catch((err: unknown) => {
        const errMsg = err instanceof Error ? err.message : String(err);
        // Error handled via sendResponse
        sendResponse({ ok: false, error: errMsg });
      });
    return true; // async response
  }
);

async function handleMessage(message: BackgroundToContentMessage): Promise<ContentResponse> {
  switch (message.type) {
    case 'GET_CURRENT_STEP': {
      const step = getCurrentStep();
      const debugText = step === 'unknown'
        ? document.body.innerText.slice(0, 300)
        : undefined;
      return { ok: true, step, ...(debugText ? { debugText } : {}) };
    }

    case 'CLICK_START': {
      const clicked = clickButton('Начать');
      if (!clicked) {
        throw new Error('Button "Начать" not found');
      }
      return { ok: true };
    }

    case 'FILL_DOCUMENT':
      await fillDocumentStep({
        series: message.series,
        number: message.number,
        issueDate: message.issueDate,
      });
      return { ok: true };

    case 'FILL_BIRTHDATE':
      await fillBirthdateStep({ birthDate: message.birthDate });
      return { ok: true };

    case 'READ_RESULT': {
      const result = readResult();
      return { ok: true, ...result };
    }

    case 'CLICK_CHECK_MORE': {
      const clicked = clickButton('Проверить ещё');
      if (!clicked) {
        throw new Error('Button "Проверить ещё" not found');
      }
      return { ok: true };
    }

    case 'DEBUG_DOM': {
      const report = debugDOM();
      return { ok: true, debugText: report } as StepResponse;
    }

    default:
      return { ok: false, error: 'Unknown command' };
  }
}
