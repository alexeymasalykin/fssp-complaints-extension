// Queue state management — pure business logic, no Chrome API dependencies

import type { Complaint, FillResult, QueueData, Settings } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';

export function createEmptyQueue(): QueueData {
  return { complaints: [], currentIndex: 0, results: [], state: 'idle' };
}

export function loadComplaints(queue: QueueData, complaints: Complaint[]): QueueData {
  return {
    complaints,
    currentIndex: 0,
    results: complaints.map((): FillResult => ({
      status: 'pending',
      timestamp: null,
      error: null,
    })),
    state: 'ready',
  };
}

export function markFilled(queue: QueueData, index: number): QueueData {
  const results = [...queue.results];
  results[index] = {
    status: 'filled',
    timestamp: new Date().toISOString(),
    error: null,
  };
  return { ...queue, state: 'filling', results };
}

export function markError(queue: QueueData, index: number, error: string): QueueData {
  const results = [...queue.results];
  results[index] = {
    status: 'error',
    timestamp: new Date().toISOString(),
    error,
  };
  return { ...queue, results };
}

export function markSubmitted(queue: QueueData): QueueData {
  if (queue.currentIndex >= queue.results.length) return queue;

  const results = [...queue.results];
  results[queue.currentIndex] = {
    status: 'submitted',
    timestamp: new Date().toISOString(),
    error: null,
  };

  const allDone = results.every(r => r.status === 'submitted' || r.status === 'error');
  return {
    ...queue,
    results,
    state: allDone ? 'completed' : queue.state,
  };
}

export function moveNext(queue: QueueData): QueueData | null {
  if (queue.currentIndex >= queue.complaints.length - 1) return null;
  return { ...queue, currentIndex: queue.currentIndex + 1 };
}

export function movePrev(queue: QueueData): QueueData | null {
  if (queue.currentIndex <= 0) return null;
  return { ...queue, currentIndex: queue.currentIndex - 1 };
}

export function canFill(queue: QueueData): boolean {
  return (queue.state === 'ready' || queue.state === 'filling') && queue.complaints.length > 0;
}

export function buildStatusUpdate(queue: QueueData, settings: Settings) {
  return {
    type: 'STATUS_UPDATE' as const,
    state: queue.state,
    currentIndex: queue.currentIndex,
    total: queue.complaints.length,
    results: queue.results,
    complaints: queue.complaints,
    settings,
  };
}

export function mergeSettings(current: Settings, patch: Partial<Settings>): Settings {
  return { ...current, ...patch };
}

export { DEFAULT_SETTINGS };
